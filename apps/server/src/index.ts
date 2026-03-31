/**
 * Dashboard Backend Entry Point
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);

// 先加载根目录 .env，再加载本地 .env（本地配置优先）
// dist/ 在 apps/server/dist/，所以需要 ../../../.env 到达根目录
const rootEnvPath = resolve(currentDir, '../../../.env');
const localEnvPath = resolve(currentDir, '../.env');

if (existsSync(rootEnvPath)) {
  console.log(`[Config] Loading root .env from: ${rootEnvPath}`);
  dotenvConfig({ path: rootEnvPath });
}
if (existsSync(localEnvPath)) {
  console.log(`[Config] Loading local .env from: ${localEnvPath}`);
  dotenvConfig({ path: localEnvPath });
}

import { start } from './app.js';

const config = {
  port: parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    path: process.env.DB_PATH || './data/dashboard.db',
  },
  openclawGateway: process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN
    ? {
        url: process.env.OPENCLAW_GATEWAY_URL,
        token: process.env.OPENCLAW_GATEWAY_TOKEN,
        reconnectInterval: process.env.OPENCLAW_GATEWAY_RECONNECT_INTERVAL
          ? parseInt(process.env.OPENCLAW_GATEWAY_RECONNECT_INTERVAL, 10)
          : undefined,
        connectionTimeout: process.env.OPENCLAW_GATEWAY_CONNECTION_TIMEOUT
          ? parseInt(process.env.OPENCLAW_GATEWAY_CONNECTION_TIMEOUT, 10)
          : undefined,
      }
    : undefined,
};

start(config).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
