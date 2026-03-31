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
import {
  FileSystemManager,
  PathValidationError,
  FileOperationError,
  FileSizeExceededError,
} from '../modules/fileSystemManager.js';
import {
  WatchManager,
  WatchError,
} from '../modules/watchManager.js';
import { createGatewayBridge } from '../modules/gatewayBridge.js';
import type { WatchEvent } from '../types/index.js';

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

  // Initialize FileSystemManager
  const fileSystemManager = new FileSystemManager(config.filesystem, logger);

  // Initialize WatchManager
  const watchManager = new WatchManager(config.filesystem, logger);

  // Set up watch event broadcasting
  watchManager.setEventHandler((event: WatchEvent) => {
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'watch.event',
      params: {
        subscriptionId: event.subscriptionId,
        type: event.type,
        path: event.path,
        timestamp: event.timestamp.toISOString(),
      },
    };

    // Find clients that own this subscription and send to them
    for (const client of clients.values()) {
      if (client.subscriptions.has(event.subscriptionId)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(notification));
        }
      }
    }

    logger.debug(
      { subscriptionId: event.subscriptionId, type: event.type, path: event.path },
      'Watch event broadcast'
    );
  });

  // Generate unique client ID
  let clientIdCounter = 0;
  const generateClientId = (): string => {
    clientIdCounter++;
    return `client-${Date.now()}-${clientIdCounter}`;
  };

  // Register file system methods
  registerFilesystemMethods(methods, fileSystemManager, logger);
  // Register watch methods
  registerWatchMethods(methods, watchManager, logger);
  // Register gateway methods
  registerGatewayMethods(methods, config, logger);

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
    watchManager.unsubscribeClient(client.id).catch((error) => {
      logger.error(
        { clientId: client.id, error: error instanceof Error ? error.message : String(error) },
        'Error cleaning up client subscriptions'
      );
    });
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

      // Handle file system errors
      if (error instanceof PathValidationError) {
        return createErrorResponse(id, {
          code: -32001,
          message: 'Path validation failed',
          data: { reason: error.message },
        });
      }

      if (error instanceof FileSizeExceededError) {
        return createErrorResponse(id, {
          code: -32002,
          message: 'File size exceeded',
          data: { reason: error.message },
        });
      }

      if (error instanceof FileOperationError) {
        return createErrorResponse(id, {
          code: -32003,
          message: 'File operation failed',
          data: { reason: error.message },
        });
      }

      // Handle watch errors
      if (error instanceof WatchError) {
        return createErrorResponse(id, {
          code: -32004,
          message: 'Watch operation failed',
          data: { reason: error.message },
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
// Method Registrations
// ============================================================

/**
 * Register file system methods
 */
function registerFilesystemMethods(
  methods: MethodRegistry,
  fsManager: FileSystemManager,
  logger: pino.Logger
): void {
  // File operations
  methods['file.read'] = async (params) => {
    const { path } = validateParams<{ path: string }>(params, ['path']);
    logger.debug({ path }, 'file.read');
    return fsManager.readFile(path);
  };

  methods['file.write'] = async (params) => {
    const { path, content, encoding } = validateParams<{
      path: string;
      content: string;
      encoding?: string;
    }>(params, ['path', 'content']);
    logger.debug({ path, encoding }, 'file.write');
    await fsManager.writeFile(path, content, encoding);
    return { success: true };
  };

  methods['file.delete'] = async (params) => {
    const { path } = validateParams<{ path: string }>(params, ['path']);
    logger.debug({ path }, 'file.delete');
    await fsManager.deleteFile(path);
    return { success: true };
  };

  methods['file.exists'] = async (params) => {
    const { path } = validateParams<{ path: string }>(params, ['path']);
    logger.debug({ path }, 'file.exists');
    const exists = await fsManager.exists(path);
    return { exists };
  };

  methods['file.stat'] = async (params) => {
    const { path } = validateParams<{ path: string }>(params, ['path']);
    logger.debug({ path }, 'file.stat');
    return fsManager.stat(path);
  };

  // Directory operations
  methods['directory.list'] = async (params) => {
    const { path, recursive } = validateParams<{
      path: string;
      recursive?: boolean;
    }>(params, ['path']);
    logger.debug({ path, recursive }, 'directory.list');
    return fsManager.listDirectory(path, recursive);
  };

  methods['directory.create'] = async (params) => {
    const { path } = validateParams<{ path: string }>(params, ['path']);
    logger.debug({ path }, 'directory.create');
    await fsManager.createDirectory(path);
    return { success: true };
  };

  methods['directory.delete'] = async (params) => {
    const { path, recursive } = validateParams<{
      path: string;
      recursive?: boolean;
    }>(params, ['path']);
    logger.debug({ path, recursive }, 'directory.delete');
    await fsManager.deleteDirectory(path, recursive);
    return { success: true };
  };
}

/**
 * Validate that params object contains required fields
 */
function validateParams<T extends Record<string, unknown>>(
  params: unknown,
  required: string[]
): T {
  if (typeof params !== 'object' || params === null) {
    throw new JsonRpcError(
      JsonRpcErrors.INVALID_PARAMS.code,
      'Params must be an object'
    );
  }

  const obj = params as Record<string, unknown>;
  const missing = required.filter((key) => !(key in obj) || obj[key] === undefined);

  if (missing.length > 0) {
    throw new JsonRpcError(
      JsonRpcErrors.INVALID_PARAMS.code,
      `Missing required parameters: ${missing.join(', ')}`
    );
  }

  return obj as T;
}

/**
 * Register watch method stubs
 */
function registerWatchMethods(
  methods: MethodRegistry,
  watchManager: WatchManager,
  logger: pino.Logger
): void {
  methods['watch.subscribe'] = async (params, client) => {
    const { path, recursive, includes, excludes, ignoreInitial } = validateParams<{
      path: string;
      recursive?: boolean;
      includes?: string[];
      excludes?: string[];
      ignoreInitial?: boolean;
    }>(params, ['path']);

    logger.debug({ path, recursive, clientId: client.id }, 'watch.subscribe');

    const options = { recursive, includes, excludes, ignoreInitial };
    return watchManager.subscribe(path, options, client.id);
  };

  methods['watch.unsubscribe'] = async (params, client) => {
    const { subscriptionId } = validateParams<{ subscriptionId: string }>(params, ['subscriptionId']);

    logger.debug({ subscriptionId, clientId: client.id }, 'watch.unsubscribe');

    await watchManager.unsubscribe(subscriptionId, client.id);
    return { success: true };
  };

  methods['watch.list'] = async () => {
    logger.debug('watch.list');
    const subscriptions = await watchManager.list();
    return { subscriptions };
  };
}

/**
 * Register gateway method stubs
 */
function registerGatewayMethods(methods: MethodRegistry, config: ServerConfig, logger: pino.Logger): void {
  const bridge = config.gateway ? createGatewayBridge(config, logger) : null;

  methods['gateway.connect'] = async () => {
    if (!bridge) throw new JsonRpcError(JsonRpcErrors.INTERNAL_ERROR.code, 'Gateway not configured');
    await bridge.handle('gateway.connect', {});
    return { success: true };
  };

  methods['gateway.disconnect'] = async () => {
    if (!bridge) return { success: true };
    await bridge.handle('gateway.disconnect', {});
    return { success: true };
  };

  methods['gateway.runAgent'] = async (params) => {
    if (!bridge) throw new JsonRpcError(JsonRpcErrors.INTERNAL_ERROR.code, 'Gateway not configured');
    logger.debug({ params }, 'gateway.runAgent');
    await bridge.handle('gateway.runAgent', params);
    return { success: true };
  };

  methods['gateway.getStatus'] = async () => {
    const result = bridge ? await bridge.handle('gateway.isConnected', {}) : false;
    return {
      connected: !!result,
      gatewayUrl: config.gateway?.url ?? null,
    };
  };

  methods['gateway.listAgents'] = async () => {
    // TODO: implement when Gateway supports agent listing
    return { agents: [] };
  };
}
