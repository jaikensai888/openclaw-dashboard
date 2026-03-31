/**
 * 任务 T3-02: 共享类型定义
 * 目标文件: packages/shared/types/src/index.ts
 *
 * 新增远程连接相关类型定义
 */

// ==================== 远程服务器 ====================

export interface RemoteServerInfo {
  id: string;                          // 格式: server_xxx
  name: string;
  host: string;
  port: number;                        // SSH 端口，默认 22
  username: string;
  privateKeyPath?: string;
  remotePort: number;                  // remote-server 端口，默认 3001
  status: RemoteServerStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type RemoteServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ==================== 文件系统 ====================

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: string;                       // ISO 8601
}

export interface FileContent {
  content: string;
  encoding: string;
  path: string;
}

// ==================== WebSocket 消息类型 ====================

// --- 客户端 → 服务器 ---
export interface WSRemoteServersPayload {
  // 请求服务器列表（无参数）
}

export interface WSRemoteSwitchPayload {
  serverId: string | null;             // null 切换回本地
}

export interface WSDirectoryListPayload {
  path: string;
  serverId?: string;                   // 可选，使用当前活跃服务器
}

export interface WSFileReadPayload {
  path: string;
  serverId?: string;
}

export interface WSWatchSubscribePayload {
  path: string;
  recursive?: boolean;
}

export interface WSWatchUnsubscribePayload {
  subscriptionId: string;
}

// --- 服务器 → 客户端 ---
export interface WSRemoteServersResultPayload {
  servers: RemoteServerInfo[];
}

export interface WSRemoteServerStatusPayload {
  id: string;
  status: RemoteServerStatus;
  error?: string;
}

export interface WSRemoteActivePayload {
  serverId: string | null;
}

export interface WSDirectoryListResultPayload {
  path: string;
  files: FileInfo[];
}

export interface WSFileReadResultPayload {
  path: string;
  content: string;
  encoding: string;
}

export interface WSWatchEventPayload {
  subscriptionId: string;
  path: string;
  type: 'created' | 'changed' | 'deleted';
}
