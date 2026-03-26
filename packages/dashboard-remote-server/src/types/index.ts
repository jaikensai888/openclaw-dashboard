// ============================================================
// Dashboard Remote Server - Type Definitions
// ============================================================

// ------------------------------------------------------------
// Server Configuration Types
// ------------------------------------------------------------

/**
 * Authentication configuration for the remote server
 */
export interface AuthConfig {
  /** Token required for client authentication */
  token: string;
}

/**
 * OpenClaw Gateway connection configuration
 */
export interface GatewayConfig {
  /** Gateway WebSocket URL (e.g., wss://gateway.example.com/ws) */
  url: string;
  /** Authentication token for Gateway connection */
  token: string;
  /** Auto-reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
}

/**
 * File system access configuration
 */
export interface FilesystemConfig {
  /** Allowed root directories for file operations */
  allowedRoots: string[];
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Whether to follow symbolic links */
  followSymlinks?: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Whether to use pretty printing for logs */
  pretty?: boolean;
  /** Log file path (optional) */
  file?: string;
}

/**
 * Remote server configuration
 */
export interface ServerConfig {
  /** Server port (default: 3002) */
  port: number;
  /** Server host (default: '0.0.0.0') */
  host: string;
  /** Authentication configuration */
  auth: AuthConfig;
  /** OpenClaw Gateway connection configuration */
  gateway?: GatewayConfig;
  /** File system access configuration */
  filesystem: FilesystemConfig;
  /** Logging configuration */
  logging: LoggingConfig;
}

// ------------------------------------------------------------
// File System Types
// ------------------------------------------------------------

/**
 * File type enumeration
 */
export type FileType = 'file' | 'directory' | 'symlink';

/**
 * File information structure
 */
export interface FileInfo {
  /** File path relative to allowed root */
  path: string;
  /** Absolute file path */
  absolutePath: string;
  /** File type */
  type: FileType;
  /** File size in bytes */
  size: number;
  /** Last modification time */
  modifiedAt: Date;
  /** File permissions (Unix mode) */
  mode?: number;
  /** Whether the file is a text file */
  isText?: boolean;
}

/**
 * File content structure
 */
export interface FileContent {
  /** File path */
  path: string;
  /** File content (text) */
  content: string;
  /** Content encoding (default: 'utf-8') */
  encoding?: string;
  /** Whether content is truncated */
  truncated?: boolean;
}

/**
 * File write options
 */
export interface FileWriteOptions {
  /** Whether to create parent directories */
  createDirs?: boolean;
  /** Whether to overwrite existing file */
  overwrite?: boolean;
  /** Content encoding (default: 'utf-8') */
  encoding?: string;
}

// ------------------------------------------------------------
// Agent Operation Types
// ------------------------------------------------------------

/**
 * Parameters for running an agent
 */
export interface RunAgentParams {
  /** Agent ID or name to run */
  agentId: string;
  /** Conversation ID for context */
  conversationId: string;
  /** Input message or prompt */
  input: string;
  /** Working directory for the agent */
  workingDir?: string;
  /** Additional context or parameters */
  context?: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Agent event types
 */
export type AgentEventType =
  | 'start'
  | 'progress'
  | 'output'
  | 'error'
  | 'complete';

/**
 * Agent event structure
 */
export interface AgentEvent {
  /** Event type */
  type: AgentEventType;
  /** Conversation ID */
  conversationId: string;
  /** Agent run ID */
  runId?: string;
  /** Event data */
  data?: unknown;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Progress message */
  message?: string;
  /** Error message (for error events) */
  error?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  /** Whether the run was successful */
  success: boolean;
  /** Run ID */
  runId: string;
  /** Final output */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Total execution time in milliseconds */
  duration?: number;
}

// ------------------------------------------------------------
// File Watch Types
// ------------------------------------------------------------

/**
 * File watch options
 */
export interface WatchOptions {
  /** Path to watch (relative to allowed root) */
  path: string;
  /** Whether to watch recursively */
  recursive?: boolean;
  /** File patterns to include */
  includes?: string[];
  /** File patterns to exclude */
  excludes?: string[];
  /** Whether to ignore initial events */
  ignoreInitial?: boolean;
}

/**
 * Watch event types
 */
export type WatchEventType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * File watch event
 */
export interface WatchEvent {
  /** Subscription ID */
  subscriptionId: string;
  /** Event type */
  type: WatchEventType;
  /** File path that triggered the event */
  path: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * File watch subscription
 */
export interface Subscription {
  /** Subscription ID */
  id: string;
  /** Watch options */
  options: WatchOptions;
  /** Creation time */
  createdAt: Date;
  /** Whether the subscription is active */
  active: boolean;
}

// ------------------------------------------------------------
// JSON-RPC Types
// ------------------------------------------------------------

/**
 * JSON-RPC request structure
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

/**
 * JSON-RPC response structure
 */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC notification structure
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}
