/**
 * Dashboard Backend Entry Point
 */

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
};

start(config).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
