/**
 * Openclaw Gateway Client
 *
 * Manages WebSocket connection to Openclaw Gateway for direct agent invocation.
 * Handles connection lifecycle, handshake protocol, and event streaming.
 */

import WebSocket from 'ws';
import type { AppConfig } from '../config.js';

// Gateway protocol types
interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

interface GatewayEvent {
  type: 'event';
  event: string;
  data: Record<string, unknown>;
}

interface ConnectChallengeEvent {
  challenge: string;
  protocol: { min: number; max: number };
}

export interface AgentEvent {
  runId: string;
  stream?: 'start' | 'delta' | 'end';
  data?: {
    delta?: string;
    content?: string;
    done?: boolean;
  };
}

type AgentEventHandler = (event: AgentEvent) => void;

export interface RunAgentOptions {
  conversationId: string;
  virtualAgentId: string;
  systemPrompt: string;
  userMessage: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
}

export interface OpenclawGatewayClientOptions {
  url: string;
  token: string;
  reconnectInterval?: number;
  connectionTimeout?: number;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'stopping';

/**
 * Openclaw Gateway WebSocket Client
 */
export class OpenclawGatewayClient {
  private ws: WebSocket | null = null;
  private options: Required<OpenclawGatewayClientOptions>;
  private status: ConnectionStatus = 'disconnected';
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private agentEventHandlers = new Set<AgentEventHandler>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;

  constructor(options: OpenclawGatewayClientOptions) {
    this.options = {
      reconnectInterval: 5000,
      connectionTimeout: 30000,
      ...options,
    };
  }

  /**
   * Start the gateway client and establish connection
   */
  async start(): Promise<void> {
    if (this.status !== 'disconnected') {
      return;
    }

    await this.connect();
  }

  /**
   * Stop the gateway client
   */
  async stop(): Promise<void> {
    this.status = 'stopping';
    this.clearTimers();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Gateway client stopped'));
      this.pendingRequests.delete(id);
    }

    this.status = 'disconnected';
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected to gateway
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Run an agent with the given options
   */
  async runAgent(options: RunAgentOptions): Promise<{ runId: string }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to gateway');
    }

    const messages = [
      { role: 'system' as const, content: options.systemPrompt },
      ...(options.history || []),
      { role: 'user' as const, content: options.userMessage },
    ];

    const result = await this.sendRequest('agent', {
      messages,
      model: options.model,
      metadata: {
        conversationId: options.conversationId,
        virtualAgentId: options.virtualAgentId,
      },
    });

    return result as { runId: string };
  }

  /**
   * Subscribe to agent events
   */
  onAgentEvent(handler: AgentEventHandler): () => void {
    this.agentEventHandlers.add(handler);
    return () => {
      this.agentEventHandlers.delete(handler);
    };
  }

  // Private methods

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = 'connecting';

      try {
        this.ws = new WebSocket(this.options.url);

        this.connectionTimeout = setTimeout(() => {
          if (this.status === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
            this.scheduleReconnect();
          }
        }, this.options.connectionTimeout);

        this.ws.on('open', () => {
          console.log('[Gateway] WebSocket connected, waiting for challenge...');
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data, resolve);
        });

        this.ws.on('error', (error) => {
          console.error('[Gateway] WebSocket error:', error.message);
          if (this.status === 'connecting') {
            clearTimeout(this.connectionTimeout!);
            reject(error);
            this.scheduleReconnect();
          }
        });

        this.ws.on('close', () => {
          console.log('[Gateway] WebSocket closed');
          this.handleDisconnect();
        });
      } catch (error) {
        reject(error);
        this.scheduleReconnect();
      }
    });
  }

  private handleMessage(data: WebSocket.RawData, connectResolve?: () => void): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'event') {
        const event = message as GatewayEvent;

        if (event.event === 'connect.challenge') {
          this.handleChallenge(event.data as unknown as ConnectChallengeEvent, connectResolve);
        } else if (event.event === 'agent') {
          this.handleAgentEvent(event.data as unknown as AgentEvent);
        }
      } else if (message.type === 'res') {
        this.handleResponse(message as GatewayResponse);
      }
    } catch (error) {
      console.error('[Gateway] Failed to parse message:', error);
    }
  }

  private handleChallenge(challenge: ConnectChallengeEvent, resolve?: () => void): void {
    console.log('[Gateway] Received challenge, sending connect request...');

    // Send connect request
    const connectParams = {
      minProtocol: challenge.protocol.min,
      maxProtocol: challenge.protocol.max,
      client: {
        id: 'openclaw-dashboard',
        version: '1.0.0',
        platform: 'node',
      },
      role: 'operator',
      scopes: ['agent', 'agent.wait'],
      auth: {
        token: this.options.token,
      },
    };

    this.sendRequest('connect', connectParams)
      .then(() => {
        this.status = 'connected';
        clearTimeout(this.connectionTimeout!);
        console.log('[Gateway] Connected successfully');
        resolve?.();
      })
      .catch((error) => {
        console.error('[Gateway] Connect failed:', error);
        this.handleDisconnect();
      });
  }

  private handleAgentEvent(event: AgentEvent): void {
    for (const handler of this.agentEventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[Gateway] Agent event handler error:', error);
      }
    }
  }

  private handleResponse(response: GatewayResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error?.message || 'Unknown error'));
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = `req_${++this.requestId}`;
      const request: GatewayRequest = {
        type: 'req',
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 60000); // 60s timeout

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws.send(JSON.stringify(request));
    });
  }

  private handleDisconnect(): void {
    if (this.status === 'stopping') {
      return;
    }

    this.status = 'disconnected';
    this.ws = null;

    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection lost'));
      this.pendingRequests.delete(id);
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.status === 'stopping') {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    console.log(`[Gateway] Reconnecting in ${this.options.reconnectInterval}ms...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.status === 'disconnected') {
        try {
          await this.connect();
        } catch (error) {
          console.error('[Gateway] Reconnect failed:', error);
          this.scheduleReconnect();
        }
      }
    }, this.options.reconnectInterval);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
}

/**
 * Create a gateway client from app config
 */
export function createGatewayClient(config: AppConfig): OpenclawGatewayClient | null {
  if (!config.openclawGateway) {
    return null;
  }

  return new OpenclawGatewayClient({
    url: config.openclawGateway.url,
    token: config.openclawGateway.token,
    reconnectInterval: config.openclawGateway.reconnectInterval,
    connectionTimeout: config.openclawGateway.connectionTimeout,
  });
}

// Singleton instance
let gatewayClientInstance: OpenclawGatewayClient | null = null;

/**
 * Initialize the gateway client singleton
 */
export function initGatewayClient(config: AppConfig): OpenclawGatewayClient | null {
  if (gatewayClientInstance) {
    return gatewayClientInstance;
  }

  gatewayClientInstance = createGatewayClient(config);
  return gatewayClientInstance;
}

/**
 * Get the gateway client singleton
 */
export function getGatewayClient(): OpenclawGatewayClient | null {
  return gatewayClientInstance;
}
