/**
 * 任务 T2-03: 清理 app.ts - 移除插件相关代码
 * 目标文件: apps/server/src/app.ts
 *
 * 变更点:
 * 1. 移除 pluginRoutes 和 pluginManager 导入
 * 2. 简化 Gateway 初始化日志
 * 3. 移除 /api/debug/plugins 和 /api/debug/test-plugin 调试端点
 * 4. 移除 pluginRoutes 路由注册
 * 5. 移除启动横幅中的 Plugin WS 行
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
// 移除: import { pluginRoutes } from './routes/plugin.js';
// 移除: import { pluginManager } from './services/pluginManager.js';
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
        initOrchestrator();
        console.log('[Orchestrator] Initialized with Gateway connection');
      } catch (error) {
        console.error('[Gateway] Failed to connect:', error);
        // 仍然初始化 orchestrator，等待 Gateway 重连
        initOrchestrator();
        console.log('[Orchestrator] Initialized, waiting for Gateway reconnection');
      }
    }
  } else {
    initOrchestrator();
    console.log('[Orchestrator] Initialized (no Gateway configured)');
  }

  // Create Fastify app
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(websocket);

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
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
  }, { prefix: '/api/v1' });

  // WebSocket routes
  await fastify.register(websocketRoutes);
  // 移除: await fastify.register(pluginRoutes);

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

  // 启动横幅 - 移除 Plugin WS 行
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Openclaw Dashboard Backend                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Server:     http://${finalConfig.host}:${finalConfig.port}                        ║
║  API:        http://${finalConfig.host}:${finalConfig.port}/api/v1               ║
║  WebSocket:  ws://${finalConfig.host}:${finalConfig.port}/ws                      ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  return fastify;
}
