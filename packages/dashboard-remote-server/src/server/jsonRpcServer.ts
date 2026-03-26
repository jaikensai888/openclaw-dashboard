/**
 * JSON-RPC 2.0 Server over WebSocket
 *
 * Implements a WebSocket server that handles JSON-RPC 2.0 protocol
 * for communication between Dashboard and Remote Server.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { IncomingMessage } from 'http';
import { pino } from 'pino';
import type {
  ServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '../types/index.js';
import { validateToken, extractTokenFromUrl } from '../utils/auth.js';

// ============================================================
// JSON-RPC Error Codes
// ============================================================

export const JsonRpcErrors = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
} as const;

// ============================================================
// Client Connection Tracking
// ============================================================

interface ClientConnection {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  connectedAt: Date;
  subscriptions: Set<string>;
}

// ============================================================
// Method Handler Types
// ============================================================

type MethodHandler = (
  params: unknown,
  client: ClientConnection
) => Promise<unknown> | unknown;

interface MethodRegistry {
  [method: string]: MethodHandler;
}

// ============================================================
// Server Interface
// ============================================================

export interface JsonRpcServer {
  /** Start listening on configured port */
  start(): Promise<void>;
  /** Close all connections and server */
  stop(): Promise<void>;
  /** Send notification to all connected clients */
  broadcast(method: string, params: unknown): void;
  /** Register a method handler */
  registerMethod(method: string, handler: MethodHandler): void;
  /** Get connected client count */
  getClientCount(): number;
}

// ============================================================
// Server Factory
// ============================================================

/**
 * Create a JSON-RPC WebSocket server
 *
 * @param config - Server configuration
 * @param logger - Pino logger instance
 * @returns JsonRpcServer interface
 */
export function createJsonRpcServer(
  config: ServerConfig,
  logger: pino.Logger
): JsonRpcServer {
  let wss: WebSocketServer | null = null;
  const clients = new Map<WebSocket, ClientConnection>();
  const methods: MethodRegistry = {};

  // Generate unique client ID
  let clientIdCounter = 0;
  const generateClientId = (): string => {
    clientIdCounter++;
    return `client-${Date.now()}-${clientIdCounter}`;
  };

  // Register stub methods for file system operations
  registerFilesystemMethods(methods, logger);
  // Register stub methods for watch operations
  registerWatchMethods(methods, logger);
  // Register stub methods for gateway operations
  registerGatewayMethods(methods, logger);

  /**
   * Handle incoming WebSocket connection
   */
  function handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = generateClientId();

    // Extract and validate token
    const url = request.url || '';
    const token = extractTokenFromUrl(url);
    const authenticated = validateToken(config, token);

    if (!authenticated) {
      logger.warn({ clientId }, 'Authentication failed, closing connection');
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Create client connection record
    const client: ClientConnection = {
      id: clientId,
      ws,
      authenticated,
      connectedAt: new Date(),
      subscriptions: new Set(),
    };

    clients.set(ws, client);
    logger.info({ clientId, clientCount: clients.size }, 'Client connected');

    // Set up message handler
    ws.on('message', (data: RawData) => {
      handleMessage(client, data);
    });

    // Handle close
    ws.on('close', () => {
      handleDisconnect(client);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error({ clientId, error: error.message }, 'WebSocket error');
    });
  }

  /**
   * Handle client disconnect
   */
  function handleDisconnect(client: ClientConnection): void {
    clients.delete(client.ws);
    logger.info(
      { clientId: client.id, clientCount: clients.size },
      'Client disconnected'
    );

    // Clean up any subscriptions associated with this client
    // (Will be implemented when WatchManager is ready)
  }

  /**
   * Handle incoming message
   */
  async function handleMessage(client: ClientConnection, data: RawData): Promise<void> {
    let message: unknown;

    // Parse message
    try {
      const str = Array.isArray(data)
        ? Buffer.concat(data as Buffer[]).toString('utf-8')
        : data.toString('utf-8');
      message = JSON.parse(str);
    } catch (error) {
      sendError(client.ws, null, JsonRpcErrors.PARSE_ERROR);
      return;
    }

    // Handle batch requests
    if (Array.isArray(message)) {
      const responses = await Promise.all(
        message.map((req) => processRequest(client, req))
      );
      // Filter out null responses (notifications)
      const validResponses = responses.filter(
        (r): r is JsonRpcResponse => r !== null
      );
      if (validResponses.length > 0) {
        send(client.ws, validResponses);
      }
      return;
    }

    // Handle single request
    const response = await processRequest(client, message);
    if (response !== null) {
      send(client.ws, response);
    }
  }

  /**
   * Process a single JSON-RPC request
   */
  async function processRequest(
    client: ClientConnection,
    message: unknown
  ): Promise<JsonRpcResponse | null> {
    // Validate request structure
    if (!isValidRequest(message)) {
      return createErrorResponse(null, JsonRpcErrors.INVALID_REQUEST);
    }

    const request = message as JsonRpcRequest;
    const { id, method, params } = request;

    // Check if it's a notification (no id)
    const isNotification = id === undefined || id === null;

    // Find method handler
    const handler = methods[method];
    if (!handler) {
      if (!isNotification) {
        return createErrorResponse(id, JsonRpcErrors.METHOD_NOT_FOUND);
      }
      return null;
    }

    // Execute method
    try {
      const result = await handler(params, client);

      // Don't send response for notifications
      if (isNotification) {
        return null;
      }

      return {
        jsonrpc: '2.0',
        id,
        result: result === undefined ? null : result,
      };
    } catch (error) {
      // Don't send response for notifications
      if (isNotification) {
        logger.error(
          { method, error: error instanceof Error ? error.message : String(error) },
          'Error handling notification'
        );
        return null;
      }

      // Handle known errors
      if (error instanceof JsonRpcError) {
        return createErrorResponse(id, {
          code: error.code,
          message: error.message,
          data: error.data,
        });
      }

      // Unknown error
      return createErrorResponse(id, JsonRpcErrors.INTERNAL_ERROR, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate JSON-RPC request structure
   */
  function isValidRequest(message: unknown): boolean {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const obj = message as Record<string, unknown>;

    // Check jsonrpc version
    if (obj.jsonrpc !== '2.0') {
      return false;
    }

    // Check method
    if (typeof obj.method !== 'string' || obj.method.length === 0) {
      return false;
    }

    // ID can be string, number, or null/undefined (for notifications)
    if (
      obj.id !== undefined &&
      obj.id !== null &&
      typeof obj.id !== 'string' &&
      typeof obj.id !== 'number'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Create error response
   */
  function createErrorResponse(
    id: string | number | null,
    error: { code: number; message: string; data?: unknown },
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: error.code,
        message: error.message,
        ...(data !== undefined && { data }),
      },
    };
  }

  /**
   * Send message to WebSocket
   */
  function send(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send error response
   */
  function sendError(
    ws: WebSocket,
    id: string | number | null,
    error: { code: number; message: string },
    data?: unknown
  ): void {
    send(ws, createErrorResponse(id, error, data));
  }

  // ============================================================
  // Public API
  // ============================================================

  return {
    async start(): Promise<void> {
      if (wss) {
        logger.warn('Server already started');
        return;
      }

      return new Promise((resolve, reject) => {
        wss = new WebSocketServer({
          port: config.port,
          host: config.host,
        });

        wss.on('connection', handleConnection);

        wss.on('error', (error) => {
          logger.error({ error: error.message }, 'WebSocket server error');
          reject(error);
        });

        wss.on('listening', () => {
          logger.info(
            { host: config.host, port: config.port },
            'WebSocket server started'
          );
          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      if (!wss) {
        logger.warn('Server not started');
        return;
      }

      return new Promise((resolve) => {
        // Close all client connections
        for (const client of clients.values()) {
          client.ws.close(1001, 'Server shutting down');
        }
        clients.clear();

        // Close server
        wss!.close(() => {
          logger.info('WebSocket server stopped');
          wss = null;
          resolve();
        });
      });
    },

    broadcast(method: string, params: unknown): void {
      const notification: JsonRpcNotification = {
        jsonrpc: '2.0',
        method,
        params,
      };

      const message = JSON.stringify(notification);
      let sent = 0;

      for (const client of clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
          sent++;
        }
      }

      logger.debug({ method, clientCount: sent }, 'Broadcast notification sent');
    },

    registerMethod(method: string, handler: MethodHandler): void {
      methods[method] = handler;
      logger.debug({ method }, 'Method registered');
    },

    getClientCount(): number {
      return clients.size;
    },
  };
}

// ============================================================
// Custom Error Class
// ============================================================

export class JsonRpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'JsonRpcError';
  }
}

// ============================================================
// Stub Method Registrations
// ============================================================

/**
 * Register file system method stubs
 */
function registerFilesystemMethods(methods: MethodRegistry, logger: pino.Logger): void {
  // File operations
  methods['file.read'] = async (params) => {
    logger.debug({ params }, 'file.read called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['file.write'] = async (params) => {
    logger.debug({ params }, 'file.write called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['file.delete'] = async (params) => {
    logger.debug({ params }, 'file.delete called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['file.exists'] = async (params) => {
    logger.debug({ params }, 'file.exists called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['file.stat'] = async (params) => {
    logger.debug({ params }, 'file.stat called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  // Directory operations
  methods['directory.list'] = async (params) => {
    logger.debug({ params }, 'directory.list called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['directory.create'] = async (params) => {
    logger.debug({ params }, 'directory.create called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['directory.delete'] = async (params) => {
    logger.debug({ params }, 'directory.delete called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };
}

/**
 * Register watch method stubs
 */
function registerWatchMethods(methods: MethodRegistry, logger: pino.Logger): void {
  methods['watch.subscribe'] = async (params, client) => {
    logger.debug({ params, clientId: client.id }, 'watch.subscribe called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['watch.unsubscribe'] = async (params, client) => {
    logger.debug({ params, clientId: client.id }, 'watch.unsubscribe called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['watch.list'] = async (params, client) => {
    logger.debug({ params, clientId: client.id }, 'watch.list called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };
}

/**
 * Register gateway method stubs
 */
function registerGatewayMethods(methods: MethodRegistry, logger: pino.Logger): void {
  methods['gateway.runAgent'] = async (params) => {
    logger.debug({ params }, 'gateway.runAgent called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['gateway.getStatus'] = async (params) => {
    logger.debug({ params }, 'gateway.getStatus called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };

  methods['gateway.listAgents'] = async (params) => {
    logger.debug({ params }, 'gateway.listAgents called (stub)');
    throw new JsonRpcError(JsonRpcErrors.METHOD_NOT_FOUND.code, 'Not implemented yet');
  };
}
