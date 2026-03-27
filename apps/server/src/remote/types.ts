// apps/server/src/remote/types.ts

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;              // SSH 端口，默认 22
  username: string;
  privateKey?: string;       // 私钥内容
  privateKeyPath?: string;   // 私钥文件路径
  remotePort: number;        // remote-server 端口，默认 3001
  // 直连模式（本地测试用）
  directUrl?: string;        // 直连 WebSocket URL，如 ws://127.0.0.1:3001
  authToken?: string;        // 认证 token
  gatewayUrl?: string;       // Gateway URL（可选）
}

export interface SSHTunnelStatus {
  serverId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  localPort?: number;
  error?: string;
}

export interface RemoteClientStatus {
  serverId: string;
  tunnelStatus: SSHTunnelStatus;
  rpcConnected: boolean;
  gatewayConnected: boolean;
}

// JSON-RPC 请求/响应类型
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// 文件系统类型
export interface RemoteFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface RemoteFileContent {
  content: string;
  encoding: string;
}

// Gateway 类型
export interface RunAgentParams {
  conversationId: string;
  message: string;
  expertId?: string;
  systemPrompt?: string;
}

export interface AgentEvent {
  type: string;
  conversationId: string;
  data: unknown;
}

// Watch 类型
export interface WatchEvent {
  subscriptionId: string;
  path: string;
  type: 'created' | 'changed' | 'deleted';
}
