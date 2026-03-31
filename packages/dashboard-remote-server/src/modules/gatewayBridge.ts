// src/modules/gatewayBridge.ts
import type { ServerConfig } from '../types/index.js';
import type { Logger } from 'pino';
import { createGatewayClient } from '../gateway/client.js';

export function createGatewayBridge(config: ServerConfig, logger: Logger) {
  let client: ReturnType<typeof createGatewayClient> | null = null;
  const broadcastCallback = new Set<(event: unknown) => void>();

  const handle = async (method: string, params: unknown): Promise<unknown> => {
    logger.debug({ method }, 'Handling gateway request');

    switch (method) {
      case 'gateway.connect':
        return connect();

      case 'gateway.disconnect':
        return disconnect();

      case 'gateway.runAgent':
        return runAgent(params as any);

      case 'gateway.isConnected':
        return client?.connected() ?? false;

      default:
        throw new Error(`Unknown gateway method: ${method}`);
    }
  };

  const connect = async (): Promise<void> => {
    if (client?.connected()) {
      logger.warn('Already connected to Gateway');
      return;
    }

    client = createGatewayClient({
      url: config.gateway!.url,
      token: config.gateway!.token,
      onAgentEvent: (event) => {
        // 广播给所有注册的回调
        for (const cb of broadcastCallback) {
          cb(event);
        }
      },
      onConnectionChange: (connected) => {
        logger.info({ connected }, 'Gateway connection state changed');
      },
    }, logger);

    await client.connect();
  };

  const disconnect = (): void => {
    if (client) {
      client.disconnect();
      client = null;
    }
  };

  const runAgent = (params: {
    conversationId: string;
    message: string;
    expertId?: string;
    systemPrompt?: string;
  }): void => {
    if (!client?.connected()) {
      throw new Error('Not connected to Gateway');
    }

    client.runAgent(params);
  };

  const registerBroadcast = (callback: (event: unknown) => void) => {
    broadcastCallback.add(callback);
    return () => broadcastCallback.delete(callback);
  };

  return { handle, registerBroadcast };
}
