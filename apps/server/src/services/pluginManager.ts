/**
 * Plugin Connection Manager
 * Manages WebSocket connections from Dashboard Plugin
 */

import type { WebSocket } from 'ws';

export interface PluginConnection {
  accountId: string;
  ws: WebSocket;
  authenticated: boolean;
  connectedAt: Date;
}

type MessageHandler = (data: { accountId: string; payload: unknown }) => void;

class PluginConnectionManager {
  private connections: Map<string, PluginConnection> = new Map();
  private messageHandlers: Map<string, MessageHandler> = new Map();

  /**
   * Register a new plugin connection
   */
  register(accountId: string, ws: WebSocket): void {
    const connection: PluginConnection = {
      accountId,
      ws,
      authenticated: false,
      connectedAt: new Date(),
    };

    this.connections.set(accountId, connection);
  }

  /**
   * Unregister a plugin connection
   */
  unregister(accountId: string): void {
    this.connections.delete(accountId);
    console.log(`[PluginManager] Plugin ${accountId} disconnected`);
  }

  /**
   * Authenticate a plugin connection
   */
  authenticate(accountId: string): boolean {
    const connection = this.connections.get(accountId);
    if (!connection) return false;

    connection.authenticated = true;
    console.log(`[PluginManager] Plugin ${accountId} authenticated`);
    return true;
  }

  /**
   * Check if a connection is authenticated
   */
  isAuthenticated(accountId: string): boolean {
    const connection = this.connections.get(accountId);
    return connection?.authenticated ?? false;
  }

  /**
   * Send a message to a specific plugin
   */
  send(accountId: string, message: { type: string; payload?: unknown }): boolean {
    const connection = this.connections.get(accountId);
    if (!connection || connection.ws.readyState !== 1) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error(`[PluginManager] Failed to send to ${accountId}:`, err);
      return false;
    }
  }

  /**
   * Broadcast a message to all authenticated plugins
   */
  broadcast(message: { type: string; payload?: unknown }): void {
    for (const [accountId, connection] of this.connections) {
      if (connection.authenticated) {
        this.send(accountId, message);
      }
    }
  }

  /**
   * Check if any plugin is connected
   */
  hasConnectedPlugin(): boolean {
    for (const connection of this.connections.values()) {
      if (connection.authenticated && connection.ws.readyState === 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all connected plugin account IDs
   */
  getConnectedAccountIds(): string[] {
    const ids: string[] = [];
    for (const [accountId, connection] of this.connections) {
      if (connection.authenticated && connection.ws.readyState === 1) {
        ids.push(accountId);
      }
    }
    return ids;
  }

  /**
   * Register a message handler
   */
  onMessage(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle incoming message from plugin (called by route handler)
   */
  handleMessage(accountId: string, message: { type?: string; payload?: unknown }): void {
    if (!message.type) {
      console.warn(`[PluginManager] Message from ${accountId} missing type`);
      return;
    }

    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler({ accountId, payload: message.payload || {} });
    } else {
      console.warn(`[PluginManager] No handler for message type: ${message.type}`);
    }
  }
}

export const pluginManager = new PluginConnectionManager();
