// src/gateway/client.ts
import WebSocket from 'ws';
import type { Logger } from 'pino';
import type {
  GatewayMessage,
  ConnectChallenge,
  ConnectRequest,
  AgentRunRequest,
} from './protocol.js';

export interface GatewayClientOptions {
  url: string;
  token?: string;
  onAgentEvent?: (event: unknown) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function createGatewayClient(options: GatewayClientOptions, logger: Logger) {
  const { url, token, onAgentEvent, onConnectionChange } = options;

  let ws: WebSocket | null = null;
  let pendingChallenge: ConnectChallenge | null = null;
  let isConnected = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      logger.info({ url }, 'Connecting to Gateway');

      ws = new WebSocket(url);

      ws.on('open', () => {
        logger.info('WebSocket connected, waiting for challenge');
      });

      ws.on('message', (data) => {
        try {
          const msg: GatewayMessage = JSON.parse(data.toString());
          handleMessage(msg, resolve, reject);
        } catch (error) {
          logger.error({ error: String(error) }, 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket closed');
        isConnected = false;
        onConnectionChange?.(false);
      });

      ws.on('error', (error) => {
        logger.error({ error: String(error) }, 'WebSocket error');
        reject(error);
      });
    });
  };

  const handleMessage = (
    msg: GatewayMessage,
    resolveConnect: () => void,
    rejectConnect: (error: Error) => void
  ) => {
    switch (msg.type) {
      case 'connect.challenge':
        pendingChallenge = msg as unknown as ConnectChallenge;
        sendConnectRequest(msg as unknown as ConnectChallenge);
        break;

      case 'connect.response':
        if ((msg as any).success) {
          logger.info('Gateway authenticated');
          isConnected = true;
          onConnectionChange?.(true);
          resolveConnect();
        } else {
          rejectConnect(new Error((msg as any).error || 'Authentication failed'));
        }
        break;

      case 'agent.event':
        onAgentEvent?.(msg);
        break;

      default:
        logger.debug({ type: msg.type }, 'Received message');
    }
  };

  const sendConnectRequest = (challenge: ConnectChallenge) => {
    if (!token) {
      logger.error('No token available for authentication');
      return;
    }

    const request: ConnectRequest = {
      type: 'connect',
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: 'dashboard-remote', mode: 'backend' },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'agent', 'agent.wait'],
      auth: { token },
      nonce: challenge.nonce,
    };

    ws?.send(JSON.stringify(request));
  };

  const runAgent = (params: {
    conversationId: string;
    message: string;
    expertId?: string;
    systemPrompt?: string;
  }): void => {
    if (!ws || !isConnected) {
      throw new Error('Not connected to Gateway');
    }

    const request: AgentRunRequest = {
      type: 'agent.run',
      ...params,
    };

    ws.send(JSON.stringify(request));
  };

  const disconnect = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    isConnected = false;
  };

  const connected = () => isConnected;

  return {
    connect,
    disconnect,
    runAgent,
    connected,
  };
}
