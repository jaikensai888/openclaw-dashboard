// src/gateway/protocol.ts
// Gateway WebSocket 协议类型定义

export interface GatewayMessage {
  type: string;
  [key: string]: unknown;
}

export interface ConnectChallenge {
  type: 'connect.challenge';
  nonce: string;
}

export interface ConnectRequest {
  type: 'connect';
  minProtocol: number;
  maxProtocol: number;
  client: { id: string; mode: string };
  role: string;
  scopes: string[];
  auth: { token: string };
  nonce: string;
}

export interface ConnectResponse {
  type: 'connect.response';
  success: boolean;
  error?: string;
}

export interface AgentRunRequest {
  type: 'agent.run';
  conversationId: string;
  message: string;
  expertId?: string;
  systemPrompt?: string;
}

export interface AgentEvent {
  type: 'agent.event';
  conversationId: string;
  eventType: string;
  data: unknown;
}
