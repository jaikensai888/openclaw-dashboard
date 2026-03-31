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
  // 乐观更新字段
  status?: 'pending' | 'sent' | 'failed';
  tempId?: string;               // 临时 ID，用于乐观更新匹配
  error?: string;                // 错误信息
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

// ------------------------------------------------------------
// Multi-Agent Types
// ------------------------------------------------------------

/** Virtual Agent identifier */
export type VirtualAgentId = string;

/** Information about an active agent */
export interface ActiveAgentInfo {
  virtualAgentId: VirtualAgentId;
  displayName: string;
  description?: string;
  /** Color for UI display (optional, e.g., '#0ea5e9') */
  color?: string;
  /** Icon name for UI display (optional) */
  icon?: string;
}

/** Reference to a Gateway run */
export interface GatewayRunRef {
  /** Gateway run ID */
  runId: string;
  /** Associated virtual agent */
  virtualAgentId: VirtualAgentId;
  /** Associated conversation */
  conversationId: string;
}

/** Handoff instruction parsed from agent output */
export interface HandoffInstruction {
  /** Agent initiating the handoff */
  fromAgentId: VirtualAgentId;
  /** Target agent for handoff */
  toAgentId: VirtualAgentId;
  /** Optional reason for handoff */
  reason?: string;
  /** Optional context to pass to target agent */
  context?: string;
}

// ------------------------------------------------------------
// Multi-Agent WebSocket Message Types
// ------------------------------------------------------------

/** Server -> Frontend: Agent activated for conversation */
export type WSAgentActivePayload = {
  conversationId: string;
  agent: ActiveAgentInfo;
};

/** Server -> Frontend: Agent handoff event */
export type WSAgentHandoffPayload = {
  conversationId: string;
  fromAgentId: VirtualAgentId;
  toAgentId: VirtualAgentId;
  reason?: string;
};

/** Frontend -> Server: Chat send with optional agent selection */
export type WSChatSendWithAgentPayload = {
  conversationId: string;
  content: string;
  /** Optional: specify which virtual agent to use */
  virtualAgentId?: VirtualAgentId;
};

/** Handoff marker pattern for parsing agent output */
export const HANDOFF_PATTERN = /^HANDOFF:(\w+)(?::(.+))?$/m;

// ------------------------------------------------------------
// Remote Connection Types
// ------------------------------------------------------------

export type RemoteServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RemoteServerInfo {
  id: string;                          // Format: server_xxx
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  remotePort: number;
  status: RemoteServerStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
}

export interface FileContent {
  content: string;
  encoding: string;
  path: string;
}

// Remote WebSocket Message Types — Client -> Server
export type WSRemoteSwitchPayload = {
  serverId: string | null;
};

export type WSDirectoryListPayload = {
  path: string;
  serverId?: string;
};

export type WSFileReadPayload = {
  path: string;
  serverId?: string;
};

export type WSWatchSubscribePayload = {
  path: string;
  recursive?: boolean;
};

export type WSWatchUnsubscribePayload = {
  subscriptionId: string;
};

// Remote WebSocket Message Types — Server -> Client
export type WSRemoteServersResultPayload = {
  servers: RemoteServerInfo[];
};

export type WSRemoteServerStatusPayload = {
  id: string;
  status: RemoteServerStatus;
  error?: string;
};

export type WSRemoteActivePayload = {
  serverId: string | null;
};

export type WSDirectoryListResultPayload = {
  path: string;
  files: FileInfo[];
  error?: string;
};

export type WSFileReadResultPayload = {
  path: string;
  content: string;
  encoding: string;
  error?: string;
};

export type WSWatchEventPayload = {
  subscriptionId: string;
  path: string;
  type: 'created' | 'changed' | 'deleted';
};
