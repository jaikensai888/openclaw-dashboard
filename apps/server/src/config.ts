/**
 * Dashboard Server Configuration
 */

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;              // SSH 端口，默认 22
  username: string;
  privateKey?: string;       // 私钥内容
  privateKeyPath?: string;   // 私钥文件路径
  remotePort: number;        // remote-server 端口，默认 3001
}

export interface OpenclawGatewayConfig {
  /** Gateway WebSocket URL (e.g., wss://gateway.example/ws) */
  url: string;
  /** Authentication token for Gateway connection */
  token: string;
  /** Auto-reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
}

export interface AppConfig {
  port: number;
  host: string;
  database: {
    path: string;
  };
  plugin?: {
    token?: string;
  };
  /** Openclaw Gateway direct connection configuration */
  openclawGateway?: OpenclawGatewayConfig;
  /** Remote server connection configuration */
  remote?: {
    enabled: boolean;
    servers: RemoteServerConfig[];
  };
}

const defaultConfig: AppConfig = {
  port: 3001,
  host: '0.0.0.0',
  database: {
    path: './data/dashboard.db',
  },
  remote: {
    enabled: false,
    servers: [],
  },
};

/**
 * Create final config by merging defaults with provided values
 */
export function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...defaultConfig,
    ...overrides,
    database: { ...defaultConfig.database, ...overrides.database },
    plugin: { ...defaultConfig.plugin, ...overrides.plugin },
    openclawGateway: overrides.openclawGateway ? {
      reconnectInterval: 5000,
      connectionTimeout: 30000,
      ...overrides.openclawGateway,
    } : undefined,
    remote: overrides.remote ? {
      ...defaultConfig.remote,
      ...overrides.remote,
    } : defaultConfig.remote,
  };
}

/**
 * Load config from environment variables
 */
export function loadConfigFromEnv(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {};

  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  if (process.env.HOST) {
    config.host = process.env.HOST;
  }
  if (process.env.DATABASE_PATH) {
    config.database = { path: process.env.DATABASE_PATH };
  }
  if (process.env.PLUGIN_TOKEN) {
    config.plugin = { token: process.env.PLUGIN_TOKEN };
  }

  // Openclaw Gateway configuration from environment
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    config.openclawGateway = {
      url: gatewayUrl,
      token: gatewayToken,
      reconnectInterval: process.env.OPENCLAW_GATEWAY_RECONNECT_INTERVAL
        ? parseInt(process.env.OPENCLAW_GATEWAY_RECONNECT_INTERVAL, 10)
        : undefined,
      connectionTimeout: process.env.OPENCLAW_GATEWAY_CONNECTION_TIMEOUT
        ? parseInt(process.env.OPENCLAW_GATEWAY_CONNECTION_TIMEOUT, 10)
        : undefined,
    };
  }

  // 远程配置
  if (process.env.REMOTE_ENABLED === 'true') {
    config.remote = {
      enabled: true,
      servers: [], // 服务器列表从数据库加载
    };
  }

  return config;
}

export { defaultConfig };
export type { AppConfig as DashboardConfig };
