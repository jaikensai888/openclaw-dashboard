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
import { artifactRoutes } from './routes/artifacts.js';
import { expertRoutes } from './routes/experts.js';
import { categoryRoutes } from './routes/categories.js';
import { automationRoutes } from './routes/automations.js';
import { rulesRoutes } from './routes/rules.js';
import { websocketRoutes } from './routes/websocket.js';
import { pluginRoutes } from './routes/plugin.js';
import { remoteRoutes } from './routes/remote.js';
import { pluginManager } from './services/pluginManager.js';
import { createConfig, AppConfig } from './config.js';
import { initGatewayClient, getGatewayClient } from './services/openclawGatewayClient.js';
import { initOrchestrator, getOrchestrator } from './services/orchestrator.js';

// Re-export config types for backward compatibility
export type { AppConfig } from './config.js';

export async function createApp(config: Partial<AppConfig> = {}) {
  const finalConfig = createConfig(config);

  // Initialize database
  await initDatabase(finalConfig.database);
  console.log(`[DB] Database initialized at ${finalConfig.database.path}`);

  // Initialize Gateway client and Orchestrator if configured
  if (finalConfig.openclawGateway) {
    const gatewayClient = initGatewayClient(finalConfig);
    if (gatewayClient) {
      console.log(`[Gateway] Initializing connection to ${finalConfig.openclawGateway.url}...`);
      try {
        await gatewayClient.start();
        console.log('[Gateway] Connected successfully');

        // Initialize orchestrator
        initOrchestrator();
        console.log('[Orchestrator] Initialized with Gateway connection');
      } catch (error) {
        console.error('[Gateway] Failed to connect:', error);
        console.log('[Gateway] Falling back to plugin mode');
      }
    }
  } else {
    // Still initialize orchestrator for plugin mode
    initOrchestrator();
    console.log('[Orchestrator] Initialized in plugin mode');
  }

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

  // Debug: Gateway connection status
  fastify.get('/api/debug/gateway', async () => {
    const gatewayClient = getGatewayClient();
    return {
      gatewayConfigured: !!finalConfig.openclawGateway,
      gatewayUrl: finalConfig.openclawGateway?.url || null,
      gatewayConnected: gatewayClient?.isConnected() ?? false,
      gatewayStatus: gatewayClient?.getStatus() ?? 'not_initialized',
      timestamp: new Date().toISOString(),
    };
  });

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
    api.register(artifactRoutes);
    api.register(expertRoutes);
    api.register(categoryRoutes);
    api.register(automationRoutes);
    api.register(rulesRoutes);
    api.register(remoteRoutes);
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
