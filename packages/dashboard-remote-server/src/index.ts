/**
 * Dashboard Remote Server
 *
 * A standalone service that runs on remote servers to bridge
 * Dashboard and OpenClaw Gateway.
 */

import { pino } from 'pino';
import { loadConfig, validateConfig } from './config.js';
import { createJsonRpcServer, type JsonRpcServer } from './server/jsonRpcServer.js';
import type { ServerConfig, JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from './types/index.js';

export * from './types/index.js';
export { loadConfig, validateConfig } from './config.js';
export { validateToken, extractTokenFromRequest, extractTokenFromUrl } from './utils/auth.js';
export { createJsonRpcServer, JsonRpcError } from './server/jsonRpcServer.js';

/**
 * Remote Server class
 *
 * Main entry point for the dashboard-remote-server package.
 * Handles JSON-RPC communication over WebSocket, file system operations,
 * file watching, and Gateway bridging.
 */
export class RemoteServer {
  private config: ServerConfig;
  private logger: pino.Logger;
  private running: boolean = false;
  private jsonRpcServer: JsonRpcServer | null = null;

  /**
   * Create a new RemoteServer instance
   * @param config - Server configuration (partial, will be merged with defaults)
   */
  constructor(config: Partial<ServerConfig> = {}) {
    this.config = loadConfig(config);
    this.logger = this.createLogger();
  }

  /**
   * Create a pino logger instance based on configuration
   */
  private createLogger(): pino.Logger {
    const { logging } = this.config;

    const transport = logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined;

    return pino({
      level: logging.level || 'info',
      transport,
    });
  }

  /**
   * Get current server configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Check if the server is currently running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the remote server
   *
   * Initializes the WebSocket server, file watchers, and Gateway connection.
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Server is already running');
      return;
    }

    try {
      validateConfig(this.config);
      this.logger.info('Starting Dashboard Remote Server...');
      this.logger.info({ config: this.getSafeConfig() }, 'Configuration loaded');

      // Initialize and start JSON-RPC server
      this.jsonRpcServer = createJsonRpcServer(this.config, this.logger);
      await this.jsonRpcServer.start();

      // TODO: Initialize file system manager
      // TODO: Initialize file watcher
      // TODO: Initialize Gateway bridge

      this.running = true;
      this.logger.info(`Server started on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.logger.error({ error }, 'Failed to start server');
      throw error;
    }
  }

  /**
   * Stop the remote server
   *
   * Closes all connections and cleans up resources.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      this.logger.warn('Server is not running');
      return;
    }

    this.logger.info('Stopping Dashboard Remote Server...');

    // Stop JSON-RPC server
    if (this.jsonRpcServer) {
      await this.jsonRpcServer.stop();
      this.jsonRpcServer = null;
    }

    // TODO: Stop file watchers
    // TODO: Close Gateway connection

    this.running = false;
    this.logger.info('Server stopped');
  }

  /**
   * Broadcast a notification to all connected clients
   *
   * @param method - JSON-RPC method name
   * @param params - Method parameters
   */
  broadcast(method: string, params: unknown): void {
    if (this.jsonRpcServer) {
      this.jsonRpcServer.broadcast(method, params);
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.jsonRpcServer?.getClientCount() ?? 0;
  }

  /**
   * Get configuration without sensitive data
   */
  private getSafeConfig(): Partial<ServerConfig> {
    return {
      port: this.config.port,
      host: this.config.host,
      auth: {
        token: this.config.auth.token ? '***' : '',
      },
      gateway: this.config.gateway
        ? {
            url: this.config.gateway.url,
            token: '***',
            reconnectInterval: this.config.gateway.reconnectInterval,
            connectionTimeout: this.config.gateway.connectionTimeout,
          }
        : undefined,
      filesystem: this.config.filesystem,
      logging: {
        ...this.config.logging,
        file: this.config.logging.file,
      },
    };
  }
}

/**
 * Create and start a remote server instance
 *
 * This is the main entry point when running the server directly.
 */
export async function createServer(config: Partial<ServerConfig> = {}): Promise<RemoteServer> {
  const server = new RemoteServer(config);
  await server.start();
  return server;
}

// Run server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new RemoteServer();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
