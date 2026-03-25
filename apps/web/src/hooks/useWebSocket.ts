import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import type { Message, Task, TaskOutput } from '@openclaw-dashboard/shared';

// 动态生成 WebSocket URL，使用当前页面的 hostname
function getWebSocketUrl(): string {
  // 优先使用环境变量
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  // 运行时动态检测浏览器环境
  // 直接使用 self 或 window，避免 webpack 静态分析问题
  // self 在浏览器和 Web Worker 中都可用
  try {
    // @ts-expect-error - 动态访问
    const location = self?.location || window?.location;
    if (location) {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const port = process.env.NEXT_PUBLIC_SERVER_PORT || '3002';
      const hostname = location.hostname || 'localhost';
      return `${protocol}//${hostname}:${port}/ws`;
    }
  } catch {
    // 忽略错误（SSR 环境中 self/window 不可访问）
  }

  // SSR 时返回占位符（实际不会被使用，因为 WebSocket 只在客户端创建）
  return 'ws://localhost:3002/ws';
}

// 每次调用都重新计算，确保使用最新的 hostname
const getWsUrl = () => getWebSocketUrl();

// WebSocket manager state
interface WSState {
  instance: WebSocket | null;
  reconnectAttempts: number;
  isConnecting: boolean;
}

// Queued message for when WebSocket is not connected
interface QueuedMessage {
  type: string;
  payload: unknown;
}

// Global state managed outside React to prevent reconnection loops
let globalState: WSState = {
  instance: null,
  reconnectAttempts: 0,
  isConnecting: false,
};

let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let connectionCount = 0;

// Message queue for when WebSocket is not connected
const messageQueue: QueuedMessage[] = [];

// Connection wait callbacks
const connectionWaitCallbacks: (() => void)[] = [];

function getWebSocket(): WebSocket | null {
  return globalState.instance;
}

// Notify all waiting callbacks that connection is established
function notifyConnectionEstablished() {
  while (connectionWaitCallbacks.length > 0) {
    const callback = connectionWaitCallbacks.shift();
    callback?.();
  }
}

// Flush queued messages when connection is established
function flushMessageQueue() {
  if (globalState.instance?.readyState !== WebSocket.OPEN) return;

  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    if (msg) {
      try {
        globalState.instance.send(JSON.stringify(msg));
        console.log('[WS] Flushed queued message:', msg.type);
      } catch (error) {
        console.error('[WS] Failed to send queued message:', error);
      }
    }
  }
}

// Wait for WebSocket connection
function waitForConnection(): Promise<void> {
  return new Promise((resolve) => {
    if (globalState.instance?.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      connectionWaitCallbacks.push(resolve);
    }
  });
}

// Single message handler - processes messages and updates store directly
function handleMessage(type: string, payload: unknown) {
  const store = useChatStore.getState();

  switch (type) {
    case 'connected':
      console.log('[WS] Server acknowledged connection');
      break;

    case 'conversation.created':
      // Handled by createConversation in store
      break;

    case 'history.conversations':
      {
        const { conversations } = payload as {
          conversations: Array<{
            id: string;
            title?: string | null;
            pinned: boolean;
            createdAt: string;
            updatedAt: string;
          }>;
        };
        store.setConversations(
          conversations.map((c) => ({
            id: c.id,
            title: c.title,
            pinned: c.pinned,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          }))
        );
      }
      break;

    case 'conversation.updated':
      {
        const { id, title, pinned, updatedAt } = payload as {
          id: string;
          title?: string;
          pinned?: boolean;
          updatedAt: string;
        };
        store.updateConversation(id, {
          ...(title !== undefined ? { title } : {}),
          ...(pinned !== undefined ? { pinned } : {}),
          updatedAt: new Date(updatedAt),
        });
      }
      break;

    case 'conversation.deleted':
      {
        const { id } = payload as { id: string };
        store.deleteConversation(id);
      }
      break;

    case 'history.messages':
      {
        const { conversationId, messages } = payload as {
          conversationId: string;
          messages: Message[];
        };
        store.setMessages(conversationId, messages);
      }
      break;

    case 'chat.message':
      {
        const msg = payload as Message;

        // 如果是确认我们发送的消息（有 tempId 且是用户消息）
        if (msg.tempId && msg.role === 'user') {
          store.confirmMessage(msg.tempId, msg);
        } else {
          // 其他消息（如 assistant 回复）正常添加
          store.addMessage(msg.conversationId, msg);
          // Stop thinking when assistant message arrives
          if (msg.role === 'assistant') {
            store.stopThinking();
          }
        }
      }
      break;

    case 'chat.streaming':
      {
        const { conversationId, delta, done } = payload as {
          conversationId: string;
          delta: string;
          done: boolean;
        };
        if (conversationId === store.currentConversationId) {
          // Always stop thinking when any streaming event arrives
          store.stopThinking();
          if (done) {
            store.clearStreaming();
          } else {
            store.setIsStreaming(true);
            store.appendStreamingContent(delta);
          }
        }
      }
      break;

    case 'task.created':
      {
        const task = payload as Task;
        store.addTask(task);
      }
      break;

    case 'task.updated':
      {
        const { taskId, status, progress, progressMessage } = payload as {
          taskId: string;
          status?: string;
          progress?: number;
          progressMessage?: string;
        };
        store.updateTask(taskId, {
          ...(status ? { status: status as Task['status'] } : {}),
          ...(progress !== undefined ? { progress } : {}),
          ...(progressMessage !== undefined ? { progressMessage } : {}),
        });
      }
      break;

    case 'task.completed':
      {
        const task = payload as Task;
        store.updateTask(task.id, { status: 'completed', progress: 100 });
      }
      break;

    case 'task.failed':
      {
        const { taskId, error } = payload as {
          taskId: string;
          error?: string;
        };
        store.updateTask(taskId, { status: 'failed', errorMessage: error });
      }
      break;

    case 'task.output':
      {
        const { taskId, output } = payload as {
          taskId: string;
          output: { id: string; type: TaskOutput['type']; content: string };
        };
        const currentOutputs = store.taskOutputs[taskId] || [];
        const taskOutput: TaskOutput = {
          id: output.id,
          taskId,
          sequence: currentOutputs.length,
          type: output.type,
          content: output.content,
          createdAt: new Date(),
        };
        store.setTaskOutputs(taskId, [...currentOutputs, taskOutput]);
      }
      break;

    case 'error':
      console.error('[WS] Server error:', payload);
      // TODO: Show error notification to user
      break;

    // Multi-Agent handlers
    case 'agents.list':
      {
        const { agents } = payload as {
          agents: Array<{
            virtualAgentId: string;
            displayName: string;
            description?: string;
            color?: string;
            icon?: string;
          }>;
        };
        store.setAvailableAgents(agents);
      }
      break;

    case 'agent.active':
      {
        const { conversationId, agent } = payload as {
          conversationId: string;
          agent: {
            virtualAgentId: string;
            displayName: string;
            description?: string;
            color?: string;
            icon?: string;
          };
        };
        store.setActiveAgent(conversationId, agent);
      }
      break;

    case 'agent.handoff':
      {
        const { conversationId, fromAgentId, toAgentId, reason } = payload as {
          conversationId: string;
          fromAgentId: string;
          toAgentId: string;
          reason?: string;
        };

        // Get target agent info
        const toAgent = store.handleAgentHandoff({
          conversationId,
          fromAgentId,
          toAgentId,
          reason,
        });

        // Add system message about handoff
        if (toAgent) {
          const fromAgent = store.availableAgents.find(
            (a) => a.virtualAgentId === fromAgentId
          );
          const handoffMessage = {
            id: `handoff_${Date.now()}`,
            conversationId,
            role: 'assistant' as const,
            content: `🔄 已从 **${fromAgent?.displayName || fromAgentId}** 移交给 **${toAgent.displayName}**${reason ? `：${reason}` : ''}`,
            messageType: 'text' as const,
            createdAt: new Date(),
          };
          store.addMessage(conversationId, handoffMessage);
        }
      }
      break;

    case 'artifact.created':
      {
        const { conversationId, artifact } = payload as {
          conversationId: string;
          artifact: {
            id: string;
            conversationId: string;
            filename: string;
            type: 'code' | 'image' | 'document' | 'other';
            mimeType: string;
            size: number;
            path: string;
            createdAt: string;
          };
        };
        store.addArtifact({
          ...artifact,
          type: artifact.type === 'other' ? 'file' : artifact.type,
          title: artifact.filename,
          createdAt: new Date(artifact.createdAt),
          updatedAt: new Date(artifact.createdAt),
        });
      }
      break;

    case 'artifact.deleted':
      {
        const { artifactId } = payload as { artifactId: string };
        store.removeArtifact(artifactId);
      }
      break;

    case 'artifacts.list':
      {
        const { conversationId, artifacts } = payload as {
          conversationId: string;
          artifacts: Array<{
            id: string;
            conversationId: string;
            filename: string;
            type: 'code' | 'image' | 'document' | 'other';
            mimeType: string;
            size: number;
            path: string;
            createdAt: string;
          }>;
        };
        store.loadArtifacts(
          conversationId,
          artifacts.map((a) => ({
            ...a,
            type: a.type === 'other' ? 'file' : a.type,
            title: a.filename,
            createdAt: new Date(a.createdAt),
            updatedAt: new Date(a.createdAt),
          }))
        );
      }
      break;

    default:
      console.warn('[WS] Unknown message type:', type);
  }
}

function connect() {
  // Don't connect if already connecting or connected
  if (globalState.isConnecting || globalState.instance?.readyState === WebSocket.OPEN) return;

  // Clean up any existing connection in non-OPEN state
  if (globalState.instance && globalState.instance.readyState !== WebSocket.OPEN) {
    globalState.instance.close();
    globalState.instance = null;
  }

  // Clear any pending callbacks from previous connection attempts
  connectionWaitCallbacks.length = 0;

  globalState.isConnecting = true;

  try {
    const ws = new WebSocket(getWsUrl());
    globalState.instance = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to server');
      globalState.reconnectAttempts = 0;
      globalState.isConnecting = false;

      // Notify waiting callbacks
      notifyConnectionEstablished();

      // Flush any queued messages
      flushMessageQueue();

      // Request available agents
      send('agents.list', {});
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type) {
          handleMessage(data.type, data.payload);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err, event.data);
        // Continue processing - don't let one bad message break the connection
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected from server', event.code, event.reason);
      globalState.instance = null;
      globalState.isConnecting = false;

      // 只在异常断开时标记 pending 消息为 failed
      // 1000 = 正常关闭, 1001 = 端点离开, 1005 = 无状态码
      // 服务器重启或其他异常断开时会重连，消息会继续发送
      if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
        const store = useChatStore.getState();
        for (const convId of Object.keys(store.messages)) {
          const messages = store.messages[convId];
          for (const msg of messages) {
            if (msg.status === 'pending' && msg.tempId) {
              store.failMessage(msg.tempId, '连接已断开');
            }
          }
        }
      }

      // Don't reconnect if this was an intentional close
      if (event.code === 1000) return;

      // Reconnect with exponential backoff
      const delay = Math.min(
        1000 * Math.pow(2, globalState.reconnectAttempts),
        30000
      );
      globalState.reconnectAttempts++;

      reconnectTimeoutId = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      globalState.isConnecting = false;
      // Don't close here - let onclose handle cleanup
    };
  } catch (error) {
    console.error('[WS] Failed to create WebSocket:', error);
    globalState.isConnecting = false;
    // Retry after delay
    reconnectTimeoutId = setTimeout(() => connect(), 5000);
  }
}

function disconnect() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (globalState.instance) {
    globalState.instance.close(1000, 'Component unmounted');
    globalState.instance = null;
  }
  globalState.isConnecting = false;
  // Clear pending connection callbacks when disconnecting
  connectionWaitCallbacks.length = 0;
}

function send(type: string, payload: unknown) {
  if (globalState.instance?.readyState === WebSocket.OPEN) {
    try {
      globalState.instance.send(JSON.stringify({ type, payload }));
    } catch (error) {
      console.error('[WS] Failed to send message:', error);
    }
  } else {
    // Queue message when not connected
    console.log('[WS] Queuing message (not connected):', type);
    messageQueue.push({ type, payload });
  }
}

export function useWebSocket() {
  const mountedRef = useRef(false);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connectionCount++;

    // Only connect if this is the first consumer
    if (connectionCount === 1) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      connectionCount--;

      // Only disconnect if this is the last consumer
      if (connectionCount === 0) {
        disconnect();
      }
    };
  }, []);

  const sendMessage = useCallback(
    (conversationId: string, content: string, expertId?: string) => {
      const currentStore = useChatStore.getState();

      // 1. 先添加本地消息（乐观更新）
      const tempId = currentStore.addPendingMessage(conversationId, content);

      // 2. 开始计时等待 AI 响应
      currentStore.startThinking();

      // 3. 发送到服务器
      send('chat.send', { conversationId, content, tempId, expertId });

      return tempId;
    },
    []
  );

  const createConversationWS = useCallback(
    (id: string, title?: string) => {
      send('conversation.create', { id, title });
    },
    []
  );

  const switchConversation = useCallback(
    (conversationId: string) => {
      send('conversation.switch', { conversationId });
    },
    []
  );

  const cancelTask = useCallback(
    (taskId: string) => {
      send('task.cancel', { taskId });
    },
    []
  );

  const loadHistory = useCallback(() => {
    send('history.load', {});
  }, []);

  const renameConversation = useCallback(
    (conversationId: string, title: string) => {
      // Optimistic update
      const store = useChatStore.getState();
      store.renameConversation(conversationId, title);
      send('conversation.rename', { conversationId, title });
    },
    []
  );

  const togglePinConversation = useCallback(
    (conversationId: string) => {
      // Optimistic update
      const store = useChatStore.getState();
      store.togglePinConversation(conversationId);
      send('conversation.togglePin', { conversationId });
    },
    []
  );

  const deleteConversation = useCallback((conversationId: string) => {
    // Optimistic update
    const store = useChatStore.getState();
    store.deleteConversation(conversationId);
    send('conversation.delete', { conversationId });
  }, []);

  const loadAgents = useCallback(() => {
    send('agents.list', {});
  }, []);

  const sendMessageWithAgent = useCallback(
    (conversationId: string, content: string, virtualAgentId?: string) => {
      const currentStore = useChatStore.getState();

      // 1. 先添加本地消息（乐观更新）
      const tempId = currentStore.addPendingMessage(conversationId, content);

      // 2. 开始计时等待 AI 响应
      currentStore.startThinking();

      // 3. 发送到服务器，带上 tempId 和可选的 virtualAgentId
      send('chat.send', { conversationId, content, tempId, virtualAgentId });

      return tempId;
    },
    []
  );

  return {
    sendMessage,
    sendMessageWithAgent,
    createConversation: createConversationWS,
    switchConversation,
    cancelTask,
    loadHistory,
    loadAgents,
    renameConversation,
    togglePinConversation,
    deleteConversation,
    isConnected: globalState.instance?.readyState === WebSocket.OPEN,
    waitForConnection,
  };
}
