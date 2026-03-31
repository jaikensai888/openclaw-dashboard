/**
 * Openclaw Gateway Client
 *
 * Manages WebSocket connection to Openclaw Gateway for direct agent invocation.
 * Handles connection lifecycle, handshake protocol, and event streaming.
 */

import WebSocket from 'ws';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AppConfig } from '../config.js';

// Device identity types
interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizeDeviceMetadata(value: string | undefined): string {
  if (typeof value !== 'string') return '';
  const t = value.trim();
  return t ? t.toLowerCase() : '';
}

function getRawPublicKeyBase64url(publicKeyPem: string): string {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return base64url(der.slice(-32));
}

function generateDeviceIdentity(stateDir: string): DeviceIdentity {
  const identityDir = path.join(stateDir, 'identity');
  fs.mkdirSync(identityDir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  const rawPubKey = getRawPublicKeyBase64url(publicKeyPem);
  const deviceId = crypto.createHash('sha256').update(rawPubKey).digest('hex');

  const identity: DeviceIdentity = {
    deviceId,
    publicKeyPem,
    privateKeyPem,
  };

  const devicePath = path.join(identityDir, 'device.json');
  fs.writeFileSync(devicePath, JSON.stringify({
    version: 1,
    ...identity,
    createdAtMs: Date.now(),
  }, null, 2), { mode: 0o600 });

  console.log('[Gateway] Generated new device identity:', deviceId);
  return identity;
}

function loadDeviceIdentity(): DeviceIdentity | null {
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), '.openclaw');
  const devicePath = path.join(stateDir, 'identity', 'device.json');
  try {
    if (!fs.existsSync(devicePath)) {
      return generateDeviceIdentity(stateDir);
    }
    const data = JSON.parse(fs.readFileSync(devicePath, 'utf8'));
    if (!data.deviceId || !data.publicKeyPem || !data.privateKeyPem) return null;
    return data as DeviceIdentity;
  } catch {
    return null;
  }
}

function buildDeviceAuthPayloadV3(params: {
  deviceId: string; clientId: string; clientMode: string; role: string;
  scopes: string; signedAtMs: number; token: string; nonce: string;
  platform: string | undefined; deviceFamily: string | undefined;
}): string {
  return [
    'v3', params.deviceId, params.clientId, params.clientMode, params.role,
    params.scopes, String(params.signedAtMs), params.token, params.nonce,
    normalizeDeviceMetadata(params.platform), normalizeDeviceMetadata(params.deviceFamily),
  ].join('|');
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  return base64url(crypto.sign(null, Buffer.from(payload, 'utf8'), key));
}

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
  payload?: unknown;  // Gateway uses 'payload' instead of 'result'
  error?: { code: string; message: string };
}

interface GatewayEvent {
  type: 'event';
  event: string;
  payload: Record<string, unknown>;
}

interface ConnectChallengeEvent {
  nonce: string;
  ts: number;
}

export interface AgentEvent {
  runId: string;
  stream?: 'lifecycle' | 'assistant' | 'start' | 'delta' | 'end';  // Include both Gateway and internal formats
  data?: {
    phase?: 'start' | 'end' | 'error';  // for lifecycle events (Gateway format)
    text?: string;            // for assistant events - full text (Gateway format)
    delta?: string;           // for assistant/delta events - incremental
    content?: string;         // accumulated content
    done?: boolean;
    error?: string;           // for error events
  };
}

type AgentEventHandler = (event: AgentEvent) => void;

// Track accumulated content per runId for end events
const runContentMap = new Map<string, string>();

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

    // Build the message with conversation history context
    let messageContent = options.userMessage;
    if (options.history && options.history.length > 0) {
      const historyContext = options.history
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n');
      messageContent = `历史对话:\n${historyContext}\n\n当前消息: ${options.userMessage}`;
    }

    // Include system prompt in the message if provided
    if (options.systemPrompt) {
      messageContent = `[系统指令: ${options.systemPrompt}]\n\n${messageContent}`;
    }

    // Map Dashboard's 'default' virtual agent to Gateway's 'main' agent
    const agentId = (!options.virtualAgentId || options.virtualAgentId === 'default')
      ? 'main'
      : options.virtualAgentId;
    const result = await this.sendRequest('agent', {
      idempotencyKey: `dash_${options.conversationId}_${Date.now()}`,
      sessionKey: `agent:${agentId}:main`,
      message: messageContent,
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
      const rawMessage = data.toString();
      console.log('[Gateway] Raw message:', rawMessage);
      const message = JSON.parse(rawMessage);

      if (message.type === 'event') {
        const event = message as GatewayEvent;
        console.log('[Gateway] Received event:', event.event);

        if (event.event === 'connect.challenge') {
          this.handleChallenge(event.payload as unknown as ConnectChallengeEvent, connectResolve);
        } else if (event.event === 'agent') {
          console.log('[Gateway] Dispatching agent event to handlers');
          this.handleAgentEvent(event.payload as unknown as AgentEvent);
        }
      } else if (message.type === 'res') {
        this.handleResponse(message as GatewayResponse);
      }
    } catch (error) {
      console.error('[Gateway] Failed to parse message:', error);
    }
  }

  private handleChallenge(challenge: ConnectChallengeEvent, resolve?: () => void): void {
    console.log('[Gateway] Received challenge with nonce:', challenge.nonce);
    console.log('[Gateway] Sending connect request...');

    const nonce = challenge.nonce;
    const role = 'operator';
    const scopes = ['operator.read', 'operator.write', 'agent', 'agent.wait'];
    const signedAtMs = Date.now();
    const platform = process.platform;

    // Load device identity for Ed25519 authentication
    const deviceIdentity = loadDeviceIdentity();
    let deviceAuth: Record<string, unknown> | undefined;

    if (deviceIdentity) {
      const payload = buildDeviceAuthPayloadV3({
        deviceId: deviceIdentity.deviceId,
        clientId: 'gateway-client',
        clientMode: 'backend',
        role,
        scopes: scopes.join(','),
        signedAtMs,
        token: this.options.token,
        nonce,
        platform,
        deviceFamily: undefined,
      });
      const signature = signDevicePayload(deviceIdentity.privateKeyPem, payload);
      deviceAuth = {
        id: deviceIdentity.deviceId,
        publicKey: getRawPublicKeyBase64url(deviceIdentity.publicKeyPem),
        signature,
        signedAt: signedAtMs,
        nonce,
      };
      console.log('[Gateway] Device identity loaded, signing challenge');
    } else {
      console.log('[Gateway] No device identity found, connecting with token-only auth (limited scopes)');
    }

    const connectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'gateway-client',
        mode: 'backend',
        version: '1.0.0',
        platform,
      },
      role,
      scopes,
      auth: {
        token: this.options.token,
      },
      device: deviceAuth,
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
    // Convert Gateway event format to internal format expected by orchestrator
    let convertedEvent: AgentEvent;

    if (event.stream === 'lifecycle') {
      const phase = event.data?.phase;

      if (phase === 'start') {

        convertedEvent = {
          runId: event.runId,
          stream: 'start',
        };
        // Initialize content tracking
        runContentMap.set(event.runId, '');
      } else if (phase === 'end') {
        // Get accumulated content
        const content = runContentMap.get(event.runId) || '';
        convertedEvent = {
          runId: event.runId,
          stream: 'end',
          data: {
            content,
            done: true,
          },
        };
        // Clean up
        runContentMap.delete(event.runId);
      } else if (phase === 'error') {
        const errorMsg = event.data?.error || 'Unknown agent error';
        convertedEvent = {
          runId: event.runId,
          stream: 'end',
          data: {
            content: `Error: ${errorMsg}`,
            done: true,
            error: errorMsg,
          },
        };
        // Clean up
        runContentMap.delete(event.runId);
      } else {
        convertedEvent = event;
      }
    } else if (event.stream === 'assistant') {
      const text = event.data?.text || event.data?.delta || '';
      // Accumulate content
      const currentContent = runContentMap.get(event.runId) || '';
      runContentMap.set(event.runId, currentContent + text);

      convertedEvent = {
        runId: event.runId,
        stream: 'delta',
        data: {
          delta: text,
          content: currentContent + text,
        },
      };
    } else {
      convertedEvent = event;
    }

    console.log('[Gateway] Converted event:', JSON.stringify(convertedEvent));

    for (const handler of this.agentEventHandlers) {
      try {
        handler(convertedEvent);
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
      // Gateway uses 'payload' field, fallback to 'result' for compatibility
      pending.resolve(response.payload ?? response.result);
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
    ...(config.openclawGateway.reconnectInterval ? { reconnectInterval: config.openclawGateway.reconnectInterval } : {}),
    ...(config.openclawGateway.connectionTimeout ? { connectionTimeout: config.openclawGateway.connectionTimeout } : {}),
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
