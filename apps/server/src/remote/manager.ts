// apps/server/src/remote/manager.ts
import type { RemoteServerConfig, RemoteClientStatus, AgentEvent } from './types.js';
import { SSHTunnelManager } from './sshTunnel.js';
import { RemoteClient } from './client.js';
import type { Logger } from 'pino';

export interface RemoteConnectionManagerOptions {
  logger: Logger;
  onAgentEvent?: (serverId: string, event: AgentEvent) => void;
  onStatusChange?: (serverId: string, status: RemoteClientStatus) => void;
}

export class RemoteConnectionManager {
  private tunnelManager: SSHTunnelManager;
  private clients = new Map<string, RemoteClient>();
  private serverConfigs = new Map<string, RemoteServerConfig>();
  private activeServerId: string | null = null;
  private logger: Logger;
  private options: RemoteConnectionManagerOptions;

  constructor(options: RemoteConnectionManagerOptions) {
    this.logger = options.logger;
    this.options = options;
    this.tunnelManager = new SSHTunnelManager(this.logger);
  }

  // 加载服务器配置（从数据库）
  loadServerConfigs(configs: RemoteServerConfig[]): void {
    this.serverConfigs.clear();
    for (const config of configs) {
      this.serverConfigs.set(config.id, config);
    }
  }

  // 连接到指定服务器
  async connect(serverId: string): Promise<void> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    this.logger.info({ serverId, directUrl: config.directUrl }, 'Connecting to remote server');

    let wsUrl: string;

    // 直连模式：跳过 SSH 隧道，直接连接 WebSocket
    if (config.directUrl) {
      this.logger.info({ directUrl: config.directUrl }, 'Using direct connection mode');
      wsUrl = config.directUrl;
    } else {
      // SSH 隧道模式
      const localPort = await this.tunnelManager.createTunnel(
        config,
        () => this.notifyStatusChange(serverId)
      );
      wsUrl = `ws://127.0.0.1:${localPort}`;
    }

    // 创建 RPC 客户端
    const client = new RemoteClient({
      url: wsUrl,
      token: config.authToken || process.env.REMOTE_AUTH_TOKEN,
      logger: this.logger.child({ serverId }),
      onAgentEvent: (event) => {
        this.options.onAgentEvent?.(serverId, event);
      },
      onConnectionChange: () => {
        this.notifyStatusChange(serverId);
      },
    });

    await client.connect();

    // 自动连接 Gateway（如果配置了）
    if (config.gatewayUrl) {
      try {
        await client.gatewayConnect();
      } catch (error) {
        this.logger.warn({ error: String(error) }, 'Failed to connect gateway');
      }
    }

    this.clients.set(serverId, client);
    this.notifyStatusChange(serverId);
  }

  // 断开服务器连接
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }

    await this.tunnelManager.closeTunnel(serverId);

    if (this.activeServerId === serverId) {
      this.activeServerId = null;
    }

    this.notifyStatusChange(serverId);
  }

  // 设置当前激活服务器
  setActiveServer(serverId: string | null): void {
    this.activeServerId = serverId;
  }

  // 获取当前激活的客户端
  getActiveClient(): RemoteClient | null {
    if (!this.activeServerId) {
      return null;
    }
    return this.clients.get(this.activeServerId) || null;
  }

  // 获取指定服务器的客户端
  getClient(serverId: string): RemoteClient | null {
    return this.clients.get(serverId) || null;
  }

  // 获取所有服务器状态
  getAllServersStatus(): RemoteClientStatus[] {
    const statuses: RemoteClientStatus[] = [];

    for (const [serverId] of this.serverConfigs) {
      const client = this.clients.get(serverId);
      const tunnelStatus = this.tunnelManager.getStatus(serverId);

      statuses.push({
        serverId,
        tunnelStatus: tunnelStatus || {
          serverId,
          status: 'disconnected',
        },
        rpcConnected: client?.isConnected ?? false,
        gatewayConnected: false,
      });
    }

    return statuses;
  }

  private notifyStatusChange(serverId: string): void {
    const client = this.clients.get(serverId);
    const tunnelStatus = this.tunnelManager.getStatus(serverId);

    this.options.onStatusChange?.(serverId, {
      serverId,
      tunnelStatus: tunnelStatus || {
        serverId,
        status: 'disconnected',
      },
      rpcConnected: client?.isConnected ?? false,
      gatewayConnected: false,
    });
  }

  // 清理所有连接
  async cleanup(): Promise<void> {
    for (const [serverId] of this.clients) {
      await this.disconnect(serverId);
    }
    await this.tunnelManager.closeAll();
  }
}

// 单例
let manager: RemoteConnectionManager | null = null;

export function getRemoteConnectionManager(): RemoteConnectionManager | null {
  return manager;
}

export function initRemoteConnectionManager(options: RemoteConnectionManagerOptions): RemoteConnectionManager {
  manager = new RemoteConnectionManager(options);
  return manager;
}
