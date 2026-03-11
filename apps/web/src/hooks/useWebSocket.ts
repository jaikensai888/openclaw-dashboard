import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import type { Message, Task, TaskOutput } from '@openclaw-dashboard/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// WebSocket manager state
interface WSState {
  instance: WebSocket | null;
  reconnectAttempts: number;
  isConnecting: boolean;
}

// Global state managed outside React to prevent reconnection loops
let globalState: WSState = {
  instance: null,
  reconnectAttempts: 0,
  isConnecting: false,
};

let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
let connectionCount = 0;

function getWebSocket(): WebSocket | null {
  return globalState.instance;
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

    default:
      console.warn('[WS] Unknown message type:', type);
  }
}

function connect() {
  if (globalState.isConnecting || globalState.instance?.readyState === WebSocket.OPEN) return;

  globalState.isConnecting = true;

  try {
    const ws = new WebSocket(WS_URL);
    globalState.instance = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to server');
      globalState.reconnectAttempts = 0;
      globalState.isConnecting = false;
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

      // 标记所有 pending 消息为 failed
      const store = useChatStore.getState();
      for (const convId of Object.keys(store.messages)) {
        const messages = store.messages[convId];
        for (const msg of messages) {
          if (msg.status === 'pending' && msg.tempId) {
            store.failMessage(msg.tempId, '连接已断开');
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
}

function send(type: string, payload: unknown) {
  if (globalState.instance?.readyState === WebSocket.OPEN) {
    try {
      globalState.instance.send(JSON.stringify({ type, payload }));
    } catch (error) {
      console.error('[WS] Failed to send message:', error);
    }
  } else {
    console.warn('[WS] Cannot send - not connected');
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
    (conversationId: string, content: string) => {
      const currentStore = useChatStore.getState();

      // 1. 先添加本地消息（乐观更新）
      const tempId = currentStore.addPendingMessage(conversationId, content);

      // 2. 发送到服务器，带上 tempId
      send('chat.send', { conversationId, content, tempId });

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

  return {
    sendMessage,
    createConversation: createConversationWS,
    switchConversation,
    cancelTask,
    loadHistory,
    renameConversation,
    togglePinConversation,
    isConnected: globalState.instance?.readyState === WebSocket.OPEN,
  };
}
