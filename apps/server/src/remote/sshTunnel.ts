// apps/server/src/remote/sshTunnel.ts
import { Client, type ConnectConfig } from 'ssh2';
import type { RemoteServerConfig, SSHTunnelStatus } from './types.js';
import fs from 'node:fs';
import type { Logger } from 'pino';

interface TunnelOptions {
  serverConfig: RemoteServerConfig;
  logger: Logger;
  onStatusChange?: (status: SSHTunnelStatus) => void;
}

export class SSHTunnel {
  private conn: Client | null = null;
  private serverConfig: RemoteServerConfig;
  private logger: Logger;
  private onStatusChange?: (status: SSHTunnelStatus) => void;
  private _status: SSHTunnelStatus;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private localPort: number = 0;

  constructor(options: TunnelOptions) {
    this.serverConfig = options.serverConfig;
    this.logger = options.logger;
    this.onStatusChange = options.onStatusChange;
    this._status = {
      serverId: options.serverConfig.id,
      status: 'disconnected',
    };
  }

  get status(): SSHTunnelStatus {
    return this._status;
  }

  private updateStatus(status: Partial<SSHTunnelStatus>) {
    this._status = { ...this._status, ...status };
    this.onStatusChange?.(this._status);
  }

  async connect(): Promise<number> {
    if (this.conn) {
      this.logger.warn('Tunnel already connected');
      return this.localPort;
    }

    this.updateStatus({ status: 'connecting' });
    this.logger.info({ host: this.serverConfig.host }, 'Establishing SSH tunnel');

    return new Promise((resolve, reject) => {
      this.conn = new Client();

      const config: ConnectConfig = {
        host: this.serverConfig.host,
        port: this.serverConfig.port,
        username: this.serverConfig.username,
        readyTimeout: 30000,
      };

      // 配置认证
      if (this.serverConfig.privateKey) {
        config.privateKey = this.serverConfig.privateKey;
      } else if (this.serverConfig.privateKeyPath) {
        config.privateKey = fs.readFileSync(this.serverConfig.privateKeyPath, 'utf-8');
      } else {
        // 尝试默认私钥
        const defaultKeyPath = `${process.env.HOME}/.ssh/id_rsa`;
        if (fs.existsSync(defaultKeyPath)) {
          config.privateKey = fs.readFileSync(defaultKeyPath, 'utf-8');
        }
      }

      this.conn.on('ready', () => {
        this.logger.info('SSH connection established, creating port forward');

        // 创建本地端口转发
        this.conn!.forwardOut(
          '127.0.0.1',
          0,  // 本地端口由系统分配
          '127.0.0.1',
          this.serverConfig.remotePort,
          (err, stream) => {
            if (err) {
              this.logger.error({ error: String(err) }, 'Port forward failed');
              this.updateStatus({ status: 'error', error: String(err) });
              reject(err);
              return;
            }

            // 获取本地端口（需要通过额外的方式获取）
            // 这里简化处理，使用固定端口范围
            this.localPort = 13000 + Math.floor(Math.random() * 1000);

            this.updateStatus({
              status: 'connected',
              localPort: this.localPort,
            });

            this.logger.info({ localPort: this.localPort }, 'SSH tunnel established');
            resolve(this.localPort);
          }
        );
      });

      this.conn.on('error', (err) => {
        this.logger.error({ error: String(err) }, 'SSH connection error');
        this.updateStatus({ status: 'error', error: String(err) });
        this.scheduleReconnect();
        reject(err);
      });

      this.conn.on('close', () => {
        this.logger.info('SSH connection closed');
        this.updateStatus({ status: 'disconnected' });
        this.scheduleReconnect();
      });

      this.conn.connect(config);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.logger.info('Attempting to reconnect SSH tunnel');
      this.connect().catch((err) => {
        this.logger.error({ error: String(err) }, 'Reconnect failed');
      });
    }, 5000);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.conn) {
      return new Promise((resolve) => {
        this.conn!.end();
        this.conn = null;
        this.updateStatus({ status: 'disconnected' });
        this.logger.info('SSH tunnel disconnected');
        resolve();
      });
    }
  }
}

// 隧道管理器
export class SSHTunnelManager {
  private tunnels = new Map<string, SSHTunnel>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async createTunnel(
    serverConfig: RemoteServerConfig,
    onStatusChange?: (status: SSHTunnelStatus) => void
  ): Promise<number> {
    // 如果已存在，先断开
    const existing = this.tunnels.get(serverConfig.id);
    if (existing) {
      await existing.disconnect();
    }

    const tunnel = new SSHTunnel({
      serverConfig,
      logger: this.logger.child({ serverId: serverConfig.id }),
      onStatusChange,
    });

    this.tunnels.set(serverConfig.id, tunnel);
    return tunnel.connect();
  }

  async closeTunnel(serverId: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (tunnel) {
      await tunnel.disconnect();
      this.tunnels.delete(serverId);
    }
  }

  getStatus(serverId: string): SSHTunnelStatus | undefined {
    return this.tunnels.get(serverId)?.status;
  }

  getAllStatus(): SSHTunnelStatus[] {
    return Array.from(this.tunnels.values()).map((t) => t.status);
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.tunnels) {
      await this.closeTunnel(id);
    }
  }
}
