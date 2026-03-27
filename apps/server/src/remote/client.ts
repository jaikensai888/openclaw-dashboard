// apps/server/src/remote/client.ts
import WebSocket from 'ws';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  RemoteFileInfo,
  RemoteFileContent,
  RunAgentParams,
  AgentEvent,
  WatchEvent,
} from './types.js';
import type { Logger } from 'pino';

type ResponseHandler = (response: JsonRpcResponse) => void;
type NotificationHandler = (notification: JsonRpcNotification) => void;

export interface RemoteClientOptions {
  url: string;
  token?: string;
  logger: Logger;
  onAgentEvent?: (event: AgentEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class RemoteClient {
  private ws: WebSocket | null = null;
  private options: RemoteClientOptions;
  private responseHandlers = new Map<string | number, ResponseHandler>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private requestId = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private _isConnected = false;

  constructor(options: RemoteClientOptions) {
    this.options = options;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.options.logger.warn('Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      const url = this.options.token
        ? `${this.options.url}?token=${this.options.token}`
        : this.options.url;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this._isConnected = true;
        this.options.logger.info('WebSocket connected to remote server');
        this.options.onConnectionChange?.(true);
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this._isConnected = false;
        this.options.logger.info('WebSocket disconnected');
        this.options.onConnectionChange?.(false);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.options.logger.error({ error: String(error) }, 'WebSocket error');
        reject(error);
      });
    });
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);

      // 检查是否是响应
      if ('id' in msg && (msg.result !== undefined || msg.error !== undefined)) {
        const handler = this.responseHandlers.get(msg.id);
        if (handler) {
          handler(msg);
          this.responseHandlers.delete(msg.id);
        }
      }
      // 检查是否是通知
      else if ('method' in msg && !('id' in msg)) {
        this.handleNotification(msg as JsonRpcNotification);
      }
    } catch (error) {
      this.options.logger.error({ error: String(error) }, 'Failed to parse message');
    }
  }

  private handleNotification(notification: JsonRpcNotification) {
    // 处理 Agent 事件
    if (notification.method === 'gateway.onAgentEvent') {
      this.options.onAgentEvent?.(notification.params as AgentEvent);
    }

    // 处理 Watch 事件
    if (notification.method === 'watch.onEvent') {
      const handlers = this.notificationHandlers.get('watch');
      handlers?.forEach((h) => h(notification));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.options.logger.info('Attempting to reconnect');
      this.connect().catch((err) => {
        this.options.logger.error({ error: String(err) }, 'Reconnect failed');
      });
    }, 5000);
  }

  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result as T);
        }
      });

      this.ws.send(JSON.stringify(request));

      // 超时处理
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // ==================== Gateway 方法 ====================

  async gatewayConnect(): Promise<void> {
    await this.sendRequest('gateway.connect');
  }

  async gatewayDisconnect(): Promise<void> {
    await this.sendRequest('gateway.disconnect');
  }

  async runAgent(params: RunAgentParams): Promise<void> {
    await this.sendRequest('gateway.runAgent', params);
  }

  async isGatewayConnected(): Promise<boolean> {
    return this.sendRequest('gateway.isConnected');
  }

  // ==================== 文件系统方法 ====================

  async readFile(path: string): Promise<RemoteFileContent> {
    return this.sendRequest('file.read', { path });
  }

  async writeFile(path: string, content: string, encoding?: string): Promise<void> {
    await this.sendRequest('file.write', { path, content, encoding });
  }

  async deleteFile(path: string): Promise<void> {
    await this.sendRequest('file.delete', { path });
  }

  async fileExists(path: string): Promise<boolean> {
    return this.sendRequest('file.exists', { path });
  }

  async listDirectory(path: string, recursive?: boolean): Promise<RemoteFileInfo[]> {
    return this.sendRequest('directory.list', { path, recursive });
  }

  // ==================== 监控方法 ====================

  async watchSubscribe(path: string): Promise<{ subscriptionId: string }> {
    return this.sendRequest('watch.subscribe', { path });
  }

  async watchUnsubscribe(subscriptionId: string): Promise<void> {
    await this.sendRequest('watch.unsubscribe', { subscriptionId });
  }

  onWatchEvent(handler: (event: WatchEvent) => void): () => void {
    if (!this.notificationHandlers.has('watch')) {
      this.notificationHandlers.set('watch', new Set());
    }
    const handlers = this.notificationHandlers.get('watch')!;

    const wrappedHandler = (notification: JsonRpcNotification) => {
      handler(notification.params as WatchEvent);
    };

    handlers.add(wrappedHandler);
    return () => {
      handlers.delete(wrappedHandler);
    };
  }

  // ==================== 连接管理 ====================

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      return new Promise((resolve) => {
        this.ws!.close();
        this.ws = null;
        this._isConnected = false;
        resolve();
      });
    }
  }
}
