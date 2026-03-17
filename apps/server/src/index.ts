/**
 * Dashboard Backend Entry Point
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env file from the same directory
dotenvConfig({ path: resolve(import.meta.dirname, '../.env') });

import { start } from './app.js';

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    path: process.env.DB_PATH || './data/dashboard.db',
  },
  plugin: {
    token: process.env.PLUGIN_TOKEN,
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
