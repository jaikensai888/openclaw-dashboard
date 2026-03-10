/**
 * Plugin WebSocket Routes
 * Handles connections from Dashboard Plugin (running in Openclaw)
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { pluginManager } from '../services/pluginManager.js';

export async function pluginRoutes(fastify: FastifyInstance) {
  fastify.register(async function (fastify) {
    fastify.get('/ws/plugin', { websocket: true }, (socket: WebSocket, req) => {
      const ws = socket;
      const token = req.headers['x-plugin-token'] as string;

      console.log('[PluginWS] Plugin connection attempt');

      // Verify token (if configured)
      const expectedToken = process.env.PLUGIN_TOKEN;
      if (expectedToken && token !== expectedToken) {
        console.warn('[PluginWS] Invalid token, rejecting connection');
        ws.send(JSON.stringify({
          type: 'plugin.auth.failed',
          payload: { reason: 'Invalid token' },
        }));
        ws.close();
        return;
      }

      // Temporary account ID until auth message
      let accountId = `temp_${Date.now()}`;

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handlePluginMessage(ws, message, (id) => { accountId = id; });
        } catch (err) {
          console.error('[PluginWS] Failed to parse message:', err);
        }
      });

      ws.on('close', () => {
        console.log(`[PluginWS] Plugin ${accountId} disconnected`);
        pluginManager.unregister(accountId);
      });

      // Send welcome
      ws.send(JSON.stringify({
        type: 'connected',
        payload: { message: 'Connected to Dashboard Backend' },
      }));
    });
  });
}

function handlePluginMessage(
  ws: WebSocket,
  message: { type: string; payload?: unknown; accountId?: string },
  setAccountId: (id: string) => void
) {
  const { type, payload } = message;

  switch (type) {
    case 'plugin.auth': {
      const authPayload = payload as { accountId?: string; pluginVersion?: string };
      const accountId = authPayload.accountId || 'default';

      setAccountId(accountId);
      pluginManager.register(accountId, ws);
      pluginManager.authenticate(accountId);

      ws.send(JSON.stringify({
        type: 'plugin.auth.success',
        payload: { accountId },
      }));

      console.log(`[PluginWS] Plugin ${accountId} authenticated (v${authPayload.pluginVersion || 'unknown'})`);
      break;
    }

    case 'agent.message':
      console.log(`[PluginWS] Received agent.message:`, JSON.stringify(message.payload));
      pluginManager.handleMessage(message.accountId || 'default', message);
      break;

    case 'agent.message.streaming':
      console.log(`[PluginWS] Received agent.message.streaming`);
      pluginManager.handleMessage(message.accountId || 'default', message);
      break;

    case 'agent.message.done':
      console.log(`[PluginWS] Received agent.message.done`);
      pluginManager.handleMessage(message.accountId || 'default', message);
      break;

    case 'agent.media':
      console.log(`[PluginWS] Received agent.media`);
      pluginManager.handleMessage(message.accountId || 'default', message);
      break;

    default:
      console.warn(`[PluginWS] Unknown message type: ${type}`);
  }
}
