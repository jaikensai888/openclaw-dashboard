/**
 * Dashboard Plugin Types
 */

export interface DashboardAccountConfig {
  enabled?: boolean;
  name?: string;
  backendUrl?: string;
  pluginToken?: string;
}

export interface ResolvedDashboardAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  backendUrl: string;
  pluginToken?: string;
  config: DashboardAccountConfig;
}

export interface WSMessage<T = unknown> {
  type: string;
  payload?: T;
}

// Messages from Dashboard Backend
export interface UserMessagePayload {
  conversationId: string;
  content: string;
  messageId: string;
}

// Messages to Dashboard Backend
export interface AgentMessagePayload {
  conversationId: string;
  content: string;
}

export interface AgentStreamingPayload {
  conversationId: string;
  delta: string;
}

export interface AgentMediaPayload {
  conversationId: string;
  text?: string;
  mediaUrl: string;
}
