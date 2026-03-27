/**
 * Dashboard Remote Server Configuration
 */

import type { ServerConfig, LoggingConfig, FilesystemConfig, AuthConfig, GatewayConfig } from './types/index.js';

/**
 * Default logging configuration
 */
const defaultLoggingConfig: LoggingConfig = {
  level: 'info',
  pretty: true,
};

/**
 * Default filesystem configuration
 */
const defaultFilesystemConfig: FilesystemConfig = {
  allowedRoots: ['.'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  followSymlinks: false,
};

/**
 * Create default server configuration
 */
export function createDefaultConfig(): ServerConfig {
  return {
    port: 3002,
    host: '0.0.0.0',
    auth: {
      token: '',
    },
    filesystem: defaultFilesystemConfig,
    logging: defaultLoggingConfig,
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<ServerConfig> {
  const config: Partial<ServerConfig> = {};

  // Server configuration
  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  if (process.env.HOST) {
    config.host = process.env.HOST;
  }

  // Authentication
  if (process.env.AUTH_TOKEN) {
    config.auth = { token: process.env.AUTH_TOKEN };
  }

  // Gateway configuration
  const gatewayUrl = process.env.GATEWAY_URL;
  const gatewayToken = process.env.GATEWAY_TOKEN;

  if (gatewayUrl && gatewayToken) {
    const gatewayConfig: GatewayConfig = {
      url: gatewayUrl,
      token: gatewayToken,
    };

    if (process.env.GATEWAY_RECONNECT_INTERVAL) {
      gatewayConfig.reconnectInterval = parseInt(process.env.GATEWAY_RECONNECT_INTERVAL, 10);
    }
    if (process.env.GATEWAY_CONNECTION_TIMEOUT) {
      gatewayConfig.connectionTimeout = parseInt(process.env.GATEWAY_CONNECTION_TIMEOUT, 10);
    }

    config.gateway = gatewayConfig;
  }

  // Filesystem configuration
  if (process.env.ALLOWED_ROOTS) {
    config.filesystem = {
      ...defaultFilesystemConfig,
      allowedRoots: process.env.ALLOWED_ROOTS.split(',').map((r) => r.trim()),
    };
  }

  // Logging configuration
  if (process.env.LOG_LEVEL) {
    config.logging = {
      ...defaultLoggingConfig,
      level: process.env.LOG_LEVEL as LoggingConfig['level'],
    };
  }
  if (process.env.LOG_PRETTY !== undefined) {
    config.logging = {
      ...(config.logging || defaultLoggingConfig),
      pretty: process.env.LOG_PRETTY === 'true',
    };
  }
  if (process.env.LOG_FILE) {
    config.logging = {
      ...(config.logging || defaultLoggingConfig),
      file: process.env.LOG_FILE,
    };
  }

  return config;
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (
        sourceValue !== undefined &&
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== undefined &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue,
          sourceValue as Partial<typeof targetValue>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Load and merge configuration from multiple sources
 * Priority: environment variables > config file > defaults
 */
export function loadConfig(fileConfig: Partial<ServerConfig> = {}): ServerConfig {
  const defaultConfig = createDefaultConfig();
  const envConfig = loadConfigFromEnv();

  // Merge in order: defaults -> file -> env
  const merged = deepMerge(defaultConfig, fileConfig);
  return deepMerge(merged, envConfig);
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): void {
  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535.`);
  }

  // Validate auth token
  if (!config.auth?.token) {
    console.warn('Warning: No authentication token configured. Server will accept all connections.');
  }

  // Validate gateway configuration if provided
  if (config.gateway) {
    if (!config.gateway.url) {
      throw new Error('Gateway URL is required when gateway configuration is provided.');
    }
    if (!config.gateway.token) {
      throw new Error('Gateway token is required when gateway configuration is provided.');
    }
  }

  // Validate filesystem configuration
  if (!config.filesystem?.allowedRoots?.length) {
    throw new Error('At least one allowed root directory must be specified.');
  }
}

export { createDefaultConfig as defaultConfig };
