// ============================================================
// Openclaw Dashboard - Shared Types
// ============================================================

// ------------------------------------------------------------
// Conversation Types
// ------------------------------------------------------------

export interface Conversation {
  id: string;                    // Format: conv_xxx
  title?: string;                // Conversation title
  pinned: boolean;               // 是否置顶
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  title?: string;
}

export interface UpdateConversationInput {
  title?: string;
  pinned?: boolean;
}

// ------------------------------------------------------------
// Message Types
// ------------------------------------------------------------

export type MessageRole = 'user' | 'assistant';
export type MessageType = 'text' | 'task_start' | 'task_update' | 'task_end';

export interface Message {
  id: string;                    // Format: msg_xxx
  conversationId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  taskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateMessageInput {
  conversationId: string;
  content: string;
  role?: MessageRole;
}

// ------------------------------------------------------------
// Task Types
// ------------------------------------------------------------

export type TaskType = 'research' | 'code' | 'file' | 'command' | 'custom';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;                    // Format: task_xxx
  conversationId: string;
  type: TaskType;
  title?: string;
  status: TaskStatus;
  progress: number;              // 0-100
  progressMessage?: string;      // Current progress message
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export type TaskOutputType = 'text' | 'code' | 'image' | 'file' | 'link';

export interface TaskOutput {
  id: string;
  taskId: string;
  sequence: number;
  type: TaskOutputType;
  content?: string;
  metadata?: {
    language?: string;      // Code language
    filename?: string;      // File name
    url?: string;           // Link URL
  };
  createdAt: Date;
}

// ------------------------------------------------------------
// Task Protocol Markers (Regex patterns)
// ------------------------------------------------------------

export const TASK_PATTERNS = {
  START: /\[TASK:START:(\w+):([^\]]+)\]/,
  PROGRESS: /\[TASK:PROGRESS:(\d+)(?::([^\]]+))?\]/,
  DONE: /\[TASK:DONE\]/,
  FAILED: /\[TASK:FAILED:([^\]]+)\]/,
} as const;

export interface TaskParseResult {
  messageType: MessageType;
  taskInfo?: {
    type?: TaskType;
    title?: string;
    status?: 'completed' | 'failed';
    progress?: number;
    message?: string;
    errorMessage?: string;
  };
  cleanContent: string;
}

// ------------------------------------------------------------
// WebSocket Message Types
// ------------------------------------------------------------

export interface WSMessage<T = unknown> {
  type: string;
  payload: T;
  requestId?: string;
}

// Frontend -> Server
export type WSChatSendPayload = {
  conversationId: string;
  content: string;
};

export type WSConversationCreatePayload = {
  title?: string;
};

export type WSConversationSwitchPayload = {
  conversationId: string;
};

export type WSTaskCancelPayload = {
  taskId: string;
};

// Server -> Frontend
export type WSChatMessagePayload = Message & {
  metadata?: Record<string, unknown>;
};

export type WSChatStreamingPayload = {
  conversationId: string;
  delta: string;
  done: boolean;
};

export type WSTaskCreatedPayload = Task;
export type WSTaskUpdatedPayload = {
  taskId: string;
  status?: TaskStatus;
  progress?: number;
  progressMessage?: string;
};
export type WSTaskCompletedPayload = Task;
export type WSTaskFailedPayload = {
  taskId: string;
  error?: string;
};

// Plugin -> Server
export type WSPluginAuthPayload = {
  accountId: string;
  pluginVersion?: string;
};

export type WSAgentMessagePayload = {
  conversationId: string;
  content: string;
};

export type WSAgentStreamingPayload = {
  conversationId: string;
  delta: string;
};

export type WSAgentMediaPayload = {
  conversationId: string;
  text?: string;
  mediaUrl: string;
};

// Server -> Plugin
export type WSUserMessagePayload = {
  conversationId: string;
  content: string;
  messageId: string;
};

// ------------------------------------------------------------
// API Response Types
// ------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
