import { useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import type { Message, Task } from '@openclaw-dashboard/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// Singleton WebSocket manager
let wsInstance: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let isConnecting = false;
let messageHandlerInitialized = false;

function getWebSocket(): WebSocket | null {
  return wsInstance;
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
        store.addMessage(msg.conversationId, msg);
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

    case 'error':
      console.error('[WS] Server error:', payload);
      break;

    default:
      console.log('[WS] Unknown message type:', type);
  }
}

function connect() {
  if (isConnecting || wsInstance?.readyState === WebSocket.OPEN) return;

  isConnecting = true;
  const ws = new WebSocket(WS_URL);
  wsInstance = ws;

  ws.onopen = () => {
    console.log('[WS] Connected to server');
    reconnectAttempts = 0;
    isConnecting = false;
  };

  ws.onmessage = (event) => {
    try {
      const { type, payload } = JSON.parse(event.data);
      handleMessage(type, payload);
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected from server');
    wsInstance = null;
    isConnecting = false;

    // Reconnect with exponential backoff
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts),
      30000
    );
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      connect();
    }, delay);
  };

  ws.onerror = (error) => {
    console.error('[WS] Error:', error);
    isConnecting = false;
  };
}

function send(type: string, payload: unknown) {
  if (wsInstance?.readyState === WebSocket.OPEN) {
    wsInstance.send(JSON.stringify({ type, payload }));
  } else {
    console.warn('[WS] Cannot send - not connected');
  }
}

// Initialize connection on module load (client-side only)
if (typeof window !== 'undefined' && !messageHandlerInitialized) {
  messageHandlerInitialized = true;
  connect();
}

export function useWebSocket() {
  const sendMessage = useCallback(
    (conversationId: string, content: string) => {
      send('chat.send', { conversationId, content });
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

  return {
    sendMessage,
    createConversation: createConversationWS,
    switchConversation,
    cancelTask,
    isConnected: getWebSocket()?.readyState === WebSocket.OPEN,
  };
}
