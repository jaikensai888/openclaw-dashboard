/**
 * Dashboard Plugin Gateway
 * Manages WebSocket connection to Dashboard Backend
 */

import WebSocket from 'ws';
import type { ResolvedDashboardAccount } from './types.js';
import { getDashboardRuntime } from './runtime.js';

export interface GatewayOptions {
  account: ResolvedDashboardAccount;
  abortSignal: AbortSignal;
  log?: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
  onReady?: () => void;
  onError?: (error: Error) => void;
}

type ConnectionState = 'connecting' | 'connected' | 'authenticating' | 'authenticated' | 'disconnected';

const connections = new Map<string, { ws: WebSocket; state: ConnectionState }>();

export async function startDashboardGateway(options: GatewayOptions): Promise<void> {
  const { account, abortSignal, log, onReady, onError } = options;

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 100;
  const reconnectDelays = [1000, 2000, 5000, 10000, 30000, 60000];
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (abortSignal.aborted) return;
    if (reconnectAttempts >= maxReconnectAttempts) {
      log?.error(`[dashboard:${account.accountId}] Max reconnect attempts reached`);
      onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    // Construct WebSocket URL - handle both cases where backendUrl may or may not include /ws/plugin
    let wsUrl = account.backendUrl;
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = wsUrl.replace(/^http/, 'ws');
    }
    if (!wsUrl.endsWith('/ws/plugin')) {
      wsUrl = `${wsUrl}/ws/plugin`;
    }
    log?.info(`[dashboard:${account.accountId}] Connecting to ${wsUrl}`);

    const ws = new WebSocket(wsUrl, {
      headers: {
        'X-Plugin-Token': account.pluginToken || '',
      },
    });

    connections.set(account.accountId, { ws, state: 'connecting' });

    ws.on('open', () => {
      log?.info(`[dashboard:${account.accountId}] WebSocket connected`);
      connections.set(account.accountId, { ws, state: 'connected' });
      reconnectAttempts = 0;

      const authMessage = {
        type: 'plugin.auth',
        payload: {
          accountId: account.accountId,
          pluginVersion: '1.0.0',
        },
      };
      ws.send(JSON.stringify(authMessage));
      connections.set(account.accountId, { ws, state: 'authenticating' });
    });

    ws.on('message', (data) => {
      try {
        const rawMessage = data.toString();
        log?.info(`[dashboard:${account.accountId}] <<< RAW MESSAGE: ${rawMessage}`);
        const message = JSON.parse(rawMessage);
        handleIncomingMessage(account.accountId, message, log);
      } catch (err) {
        log?.error(`[dashboard:${account.accountId}] Failed to parse message:`, err);
      }
    });

    ws.on('close', (code, reason) => {
      log?.warn(`[dashboard:${account.accountId}] WebSocket closed: ${code} ${reason}`);
      connections.set(account.accountId, { ws, state: 'disconnected' });

      if (!abortSignal.aborted) {
        const delay = reconnectDelays[Math.min(reconnectAttempts, reconnectDelays.length - 1)];
        reconnectAttempts++;
        log?.info(`[dashboard:${account.accountId}] Reconnecting in ${delay}ms`);
        reconnectTimer = setTimeout(connect, delay);
      }
    });

    ws.on('error', (err) => {
      log?.error(`[dashboard:${account.accountId}] WebSocket error:`, err.message);
      connections.set(account.accountId, { ws, state: 'disconnected' });
      onError?.(err);
    });
  };

  const handleIncomingMessage = (
    accountId: string,
    message: { type: string; payload?: unknown },
    log?: GatewayOptions['log']
  ) => {
    const { type, payload } = message;
    log?.info(`[dashboard:${accountId}] >>> Processing message type: ${type}`);

    switch (type) {
      case 'connected':
        log?.debug(`[dashboard:${accountId}] Server acknowledged connection`);
        break;

      case 'plugin.auth.success':
        log?.info(`[dashboard:${accountId}] Authentication successful`);
        const conn = connections.get(accountId);
        if (conn) connections.set(accountId, { ...conn, state: 'authenticated' });
        onReady?.();
        break;

      case 'plugin.auth.failed':
        log?.error(`[dashboard:${accountId}] Authentication failed`);
        connections.get(accountId)?.ws.close();
        onError?.(new Error('Authentication failed'));
        break;

      case 'user.message':
        handleUserMessage(accountId, payload as { conversationId: string; content: string; messageId: string }, log);
        break;

      default:
        log?.debug(`[dashboard:${accountId}] Unknown message type: ${type}`);
    }
  };

  const handleUserMessage = async (
    accountId: string,
    payload: { conversationId: string; content: string; messageId: string },
    log?: GatewayOptions['log']
  ) => {
    log?.info(`[dashboard:${accountId}] Received user message for ${payload.conversationId}`);

    const runtime = getDashboardRuntime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = runtime as any;

    // Debug logging to understand the runtime structure
    log?.info(`[dashboard:${accountId}] Runtime exists: ${!!rt}`);
    log?.info(`[dashboard:${accountId}] Runtime.channel exists: ${!!rt?.channel}`);
    log?.info(`[dashboard:${accountId}] Runtime.channel.reply exists: ${!!rt?.channel?.reply}`);
    log?.info(`[dashboard:${accountId}] Runtime.channel.reply.handleIncomingMessage exists: ${!!rt?.channel?.reply?.handleIncomingMessage}`);
    log?.info(`[dashboard:${accountId}] Runtime.channel.handleIncomingMessage exists: ${!!rt?.channel?.handleIncomingMessage}`);

    // Try runtime.channel.reply.handleIncomingMessage first (correct API path)
    if (rt?.channel?.reply?.handleIncomingMessage) {
      try {
        log?.info(`[dashboard:${accountId}] Using channel.reply.handleIncomingMessage API`);
        await rt.channel.reply.handleIncomingMessage({
          channel: 'dashboard',
          to: `dashboard:conversation:${payload.conversationId}`,
          from: 'user',
          content: payload.content,
          messageId: payload.messageId,
          timestamp: Date.now(),
          metadata: { accountId, conversationId: payload.conversationId },
        });
        log?.info(`[dashboard:${accountId}] handleIncomingMessage completed`);
        return;
      } catch (err) {
        log?.error(`[dashboard:${accountId}] channel.reply.handleIncomingMessage failed:`, err);
      }
    }

    // Fallback: Try runtime.channel.handleIncomingMessage
    if (rt?.channel?.handleIncomingMessage) {
      try {
        log?.info(`[dashboard:${accountId}] Using channel.handleIncomingMessage API`);
        await rt.channel.handleIncomingMessage({
          channel: 'dashboard',
          to: `dashboard:conversation:${payload.conversationId}`,
          from: 'user',
          content: payload.content,
          messageId: payload.messageId,
          timestamp: Date.now(),
          metadata: { accountId, conversationId: payload.conversationId },
        });
        log?.info(`[dashboard:${accountId}] handleIncomingMessage completed`);
        return;
      } catch (err) {
        log?.error(`[dashboard:${accountId}] channel.handleIncomingMessage failed:`, err);
      }
    }

    log?.warn(`[dashboard:${accountId}] No channel handler available - cannot process message`);
  };

  connect();

  abortSignal.addEventListener('abort', () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    connections.get(account.accountId)?.ws.close();
    connections.delete(account.accountId);
  });
}

export function sendToDashboard(accountId: string, message: { type: string; payload?: unknown }): boolean {
  const conn = connections.get(accountId);
  if (!conn || conn.state !== 'authenticated' || conn.ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    conn.ws.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function sendAgentMessage(accountId: string, conversationId: string, content: string): boolean {
  return sendToDashboard(accountId, { type: 'agent.message', payload: { conversationId, content } });
}

export function sendAgentStreaming(accountId: string, conversationId: string, delta: string): boolean {
  return sendToDashboard(accountId, { type: 'agent.message.streaming', payload: { conversationId, delta } });
}

export function sendAgentMessageDone(accountId: string, conversationId: string): boolean {
  return sendToDashboard(accountId, { type: 'agent.message.done', payload: { conversationId } });
}

export function sendAgentMedia(accountId: string, conversationId: string, options: { text?: string; mediaUrl: string }): boolean {
  return sendToDashboard(accountId, { type: 'agent.media', payload: { conversationId, ...options } });
}

export function isAuthenticated(accountId: string): boolean {
  const conn = connections.get(accountId);
  return conn?.state === 'authenticated' && conn.ws.readyState === WebSocket.OPEN;
}

export function getAuthenticatedAccountIds(): string[] {
  return Array.from(connections.entries())
    .filter(([, conn]) => conn.state === 'authenticated' && conn.ws.readyState === WebSocket.OPEN)
    .map(([id]) => id);
}
