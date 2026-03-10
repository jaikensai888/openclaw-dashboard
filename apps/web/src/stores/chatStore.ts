import { create } from 'zustand';

// Types
interface Conversation {
  id: string;
  title?: string | null;
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

interface ChatState {
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  setCurrentConversation: (id: string) => void;
  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  setConversations: (conversations: Conversation[]) => void;

  // Messages
  messages: Record<string, Message[]>;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;

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

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  taskModalTaskId: string | null;
  setTaskModalTaskId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Conversations
  conversations: [],
  currentConversationId: null,

  setCurrentConversation: (id) => set({ currentConversationId: id }),

  createConversation: (title) => {
    const id = `conv_${Date.now().toString(36)}`;
    const now = new Date();
    const newConv: Conversation = {
      id,
      title: title || '新对话',
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

  setConversations: (conversations) => set({ conversations }),

  // Messages
  messages: {},

  addMessage: (conversationId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    }));
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

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (delta) => {
    set((state) => ({ streamingContent: state.streamingContent + delta }));
  },

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  clearStreaming: () => set({ streamingContent: '', isStreaming: false }),

  // UI
  sidebarOpen: true,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  taskModalTaskId: null,

  setTaskModalTaskId: (id) => set({ taskModalTaskId: id }),
}));

// Export types for use in other files
export type { Conversation, Message, Task, TaskOutput };
