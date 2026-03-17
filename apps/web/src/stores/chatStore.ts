import { create } from 'zustand';

// Types
interface Conversation {
  id: string;
  title?: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'task_start' | 'task_update' | 'task_end';
  taskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  // 乐观更新字段
  status?: 'pending' | 'sent' | 'failed';
  tempId?: string;
  error?: string;
}

interface Task {
  id: string;
  conversationId: string;
  type: string;
  title?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

interface TaskOutput {
  id: string;
  taskId: string;
  sequence: number;
  type: 'text' | 'code' | 'image' | 'file' | 'link';
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

// Multi-Agent Types
interface ActiveAgentInfo {
  virtualAgentId: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface HandoffEvent {
  conversationId: string;
  fromAgentId: string;
  toAgentId: string;
  reason?: string;
}

interface ChatState {
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  isHistoryLoaded: boolean;
  setCurrentConversation: (id: string) => void;
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setHistoryLoaded: (loaded: boolean) => void;
  renameConversation: (id: string, title: string) => void;
  togglePinConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;

  // Messages
  messages: Record<string, Message[]>;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  // 乐观更新 actions
  addPendingMessage: (conversationId: string, content: string) => string;
  confirmMessage: (tempId: string, serverMessage: Message) => void;
  failMessage: (tempId: string, error: string) => void;
  retryMessage: (tempId: string, conversationId: string, content: string) => void;

  // Tasks
  tasks: Record<string, Task>;
  taskOutputs: Record<string, TaskOutput[]>;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setTaskOutputs: (taskId: string, outputs: TaskOutput[]) => void;

  // Streaming
  streamingContent: string;
  isStreaming: boolean;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (delta: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  clearStreaming: () => void;

  // Thinking (waiting for AI response)
  thinkingStartTime: number | null;
  isThinking: boolean;
  startThinking: () => void;
  stopThinking: () => void;
  getThinkingDuration: () => number;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  taskModalTaskId: string | null;
  setTaskModalTaskId: (id: string | null) => void;

  // Multi-Agent
  availableAgents: ActiveAgentInfo[];
  currentAgentByConversation: Record<string, ActiveAgentInfo>;
  setAvailableAgents: (agents: ActiveAgentInfo[]) => void;
  setActiveAgent: (conversationId: string, agent: ActiveAgentInfo) => void;
  handleAgentHandoff: (handoff: HandoffEvent) => ActiveAgentInfo | null;
  getCurrentAgent: (conversationId: string) => ActiveAgentInfo | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Conversations
  conversations: [],
  currentConversationId: null,
  isHistoryLoaded: false,

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  createConversation: (title) => {
    const id = `conv_${Date.now().toString(36)}`;
    const now = new Date();
    const newConv: Conversation = {
      id,
      title: title || '新对话',
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      conversations: [newConv, ...state.conversations],
      currentConversationId: id,
      messages: { ...state.messages, [id]: [] },
    }));
    return id;
  },

  deleteConversation: (id) => {
    set((state) => {
      const { [id]: _, ...remainingMessages } = state.messages;
      const newConversations = state.conversations.filter((c) => c.id !== id);
      return {
        conversations: newConversations,
        messages: remainingMessages,
        currentConversationId:
          state.currentConversationId === id
            ? newConversations[0]?.id || null
            : state.currentConversationId,
      };
    });
  },

  setConversations: (conversations) => set({ conversations, isHistoryLoaded: true }),

  setHistoryLoaded: (loaded) => set({ isHistoryLoaded: loaded }),

  renameConversation: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: new Date() } : c
      ),
    }));
  },

  togglePinConversation: (id) => {
    set((state) => {
      const conversation = state.conversations.find((c) => c.id === id);
      if (!conversation) return state;

      const newPinned = !conversation.pinned;
      const updatedConversations = state.conversations
        .map((c) =>
          c.id === id ? { ...c, pinned: newPinned, updatedAt: new Date() } : c
        )
        .sort((a, b) => {
          // 置顶的排在前面，然后按更新时间排序
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

      return { conversations: updatedConversations };
    });
  },

  updateConversation: (id, updates) => {
    set((state) => {
      const updatedConversations = state.conversations
        .map((c) => (c.id === id ? { ...c, ...updates } : c))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

      return { conversations: updatedConversations };
    });
  },

  // Messages
  messages: {},

  addMessage: (conversationId, message) => {
    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      // Prevent duplicate messages by checking message ID
      if (existingMessages.some((m) => m.id === message.id)) {
        console.log(`[Store] Skipping duplicate message: ${message.id}`);
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
      };
    });
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    }));
  },

  setMessages: (conversationId, messages) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    }));
  },

  // 乐观更新 actions
  addPendingMessage: (conversationId, content) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const pendingMessage: Message = {
      id: tempId,
      conversationId,
      role: 'user',
      content,
      messageType: 'text',
      createdAt: now,
      status: 'pending',
      tempId,
    };

    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, pendingMessage],
        },
      };
    });

    return tempId;
  },

  confirmMessage: (tempId, serverMessage) => {
    set((state) => {
      const conversationId = serverMessage.conversationId;
      const messages = state.messages[conversationId] || [];

      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) =>
            msg.tempId === tempId
              ? { ...serverMessage, status: 'sent' }
              : msg
          ),
        },
      };
    });
  },

  failMessage: (tempId, error) => {
    set((state) => {
      // 找到对应的消息
      for (const conversationId of Object.keys(state.messages)) {
        const messages = state.messages[conversationId];
        const msgIndex = messages.findIndex((m) => m.tempId === tempId);
        if (msgIndex !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[msgIndex] = {
            ...updatedMessages[msgIndex],
            status: 'failed',
            error,
          };
          return {
            messages: {
              ...state.messages,
              [conversationId]: updatedMessages,
            },
          };
        }
      }
      return state;
    });
  },

  retryMessage: (tempId, conversationId, content) => {
    set((state) => {
      const messages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) =>
            msg.tempId === tempId
              ? { ...msg, status: 'pending', error: undefined }
              : msg
          ),
        },
      };
    });
  },

  // Tasks
  tasks: {},
  taskOutputs: {},

  addTask: (task) => {
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
  },

  updateTask: (taskId, updates) => {
    set((state) => {
      const task = state.tasks[taskId];
      if (!task) return state;
      return {
        tasks: { ...state.tasks, [taskId]: { ...task, ...updates } },
      };
    });
  },

  setTaskOutputs: (taskId, outputs) => {
    set((state) => ({
      taskOutputs: { ...state.taskOutputs, [taskId]: outputs },
    }));
  },

  // Streaming
  streamingContent: '',
  isStreaming: false,
  thinkingStartTime: null as number | null,
  isThinking: false,

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (delta) => {
    set((state) => ({ streamingContent: state.streamingContent + delta }));
  },

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  clearStreaming: () => set({ streamingContent: '', isStreaming: false, thinkingStartTime: null, isThinking: false }),

  // Thinking (等待响应)
  startThinking: () => set({ thinkingStartTime: Date.now(), isThinking: true }),

  stopThinking: () => set({ thinkingStartTime: null, isThinking: false }),

  getThinkingDuration: () => {
    const state = get();
    if (!state.thinkingStartTime) return 0;
    return Math.floor((Date.now() - state.thinkingStartTime) / 1000);
  },

  // UI
  sidebarOpen: true,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  taskModalTaskId: null,

  setTaskModalTaskId: (id) => set({ taskModalTaskId: id }),

  // Multi-Agent
  availableAgents: [],
  currentAgentByConversation: {},

  setAvailableAgents: (agents) => set({ availableAgents: agents }),

  setActiveAgent: (conversationId, agent) => set((state) => ({
    currentAgentByConversation: {
      ...state.currentAgentByConversation,
      [conversationId]: agent,
    },
  })),

  handleAgentHandoff: (handoff) => {
    const state = get();
    const toAgent = state.availableAgents.find(
      (a) => a.virtualAgentId === handoff.toAgentId
    );

    if (toAgent) {
      set({
        currentAgentByConversation: {
          ...state.currentAgentByConversation,
          [handoff.conversationId]: toAgent,
        },
      });
    }

    return toAgent || null;
  },

  getCurrentAgent: (conversationId) => {
    const state = get();
    return state.currentAgentByConversation[conversationId] || null;
  },
}));

// Export types for use in other files
export type { Conversation, Message, Task, TaskOutput, ActiveAgentInfo, HandoffEvent };
