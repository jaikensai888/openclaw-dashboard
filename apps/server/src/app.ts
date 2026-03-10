/**
 * Dashboard Backend Application
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { initDatabase, closeDatabase } from './db/index.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { taskRoutes } from './routes/tasks.js';
import { websocketRoutes } from './routes/websocket.js';
import { pluginRoutes } from './routes/plugin.js';
import { pluginManager } from './services/pluginManager.js';

export interface AppConfig {
  port: number;
  host: string;
  database: {
    path: string;
  };
  plugin?: {
    token?: string;
  };
}

const defaultConfig: AppConfig = {
  port: 3001,
  host: '0.0.0.0',
  database: {
    path: './data/dashboard.db',
  },
};

export async function createApp(config: Partial<AppConfig> = {}) {
  const finalConfig: AppConfig = {
    ...defaultConfig,
    ...config,
    database: { ...defaultConfig.database, ...config.database },
    plugin: { ...defaultConfig.plugin, ...config.plugin },
  };

  // Initialize database
  await initDatabase(finalConfig.database);
  console.log(`[DB] Database initialized at ${finalConfig.database.path}`);

  // Create Fastify app
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(websocket);

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Debug: Plugin connection status
  fastify.get('/api/debug/plugins', async () => ({
    connectedPlugins: pluginManager.getConnectedAccountIds(),
    hasConnectedPlugin: pluginManager.hasConnectedPlugin(),
    timestamp: new Date().toISOString(),
  }));

  // Debug: Test send message to plugin
  fastify.post('/api/debug/test-plugin', async (request) => {
    const body = request.body as { content?: string } | undefined;
    const content = body?.content || 'test message';
    const accountIds = pluginManager.getConnectedAccountIds();
    const result = {
      timestamp: new Date().toISOString(),
      connectedPlugins: accountIds,
      sent: false,
    };

    if (accountIds.length > 0) {
      result.sent = pluginManager.send(accountIds[0], {
        type: 'user.message',
        payload: {
          conversationId: 'debug_test',
          content,
          messageId: `debug_msg_${Date.now()}`,
        },
      });
    }

    return result;
  });

  // API routes
  await fastify.register(async (api) => {
    api.register(conversationRoutes);
    api.register(messageRoutes);
    api.register(taskRoutes);
  }, { prefix: '/api/v1' });

  // WebSocket routes
  await fastify.register(websocketRoutes);
  await fastify.register(pluginRoutes);

  // Cleanup on shutdown
  const cleanup = async () => {
    console.log('\n[App] Shutting down...');
    closeDatabase();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { fastify, config: finalConfig };
}

export async function start(config: Partial<AppConfig> = {}) {
  const { fastify, config: finalConfig } = await createApp(config);

  await fastify.listen({
    port: finalConfig.port,
    host: finalConfig.host,
  });

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Openclaw Dashboard Backend                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     http://${finalConfig.host}:${finalConfig.port}                        ║
║  API:        http://${finalConfig.host}:${finalConfig.port}/api/v1               ║
║  WebSocket:  ws://${finalConfig.host}:${finalConfig.port}/ws                      ║
║  Plugin WS:  ws://${finalConfig.host}:${finalConfig.port}/ws/plugin               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  return fastify;
}
