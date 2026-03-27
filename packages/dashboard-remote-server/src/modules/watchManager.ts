/**
 * File Watch Manager
 *
 * Provides file watching functionality using chokidar for monitoring
 * file system changes within allowed directories.
 */

import * as path from 'path';
import * as chokidar from 'chokidar';
import type { pino } from 'pino';
import type {
  FilesystemConfig,
  WatchOptions,
  WatchEvent,
  WatchEventType,
  Subscription,
} from '../types/index.js';
import { validatePath } from '../utils/pathUtils.js';

// ============================================================
// Custom Errors
// ============================================================

/**
 * Error thrown when watch operation fails
 */
export class WatchError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WatchError';
  }
}

// ============================================================
// Internal Subscription Type
// ============================================================

interface InternalSubscription extends Subscription {
  /** Chokidar watcher instance */
  watcher: chokidar.FSWatcher;
  /** Client IDs that own this subscription */
  clientIds: Set<string>;
}

// ============================================================
// Event Handler Type
// ============================================================

export type WatchEventHandler = (event: WatchEvent) => void;

// ============================================================
// WatchManager Class
// ============================================================

/**
 * Manages file watching operations with security constraints
 */
export class WatchManager {
  private readonly resolvedRoots: string[];
  private readonly subscriptions: Map<string, InternalSubscription> = new Map();
  private eventHandler: WatchEventHandler | null = null;
  private subscriptionIdCounter = 0;

  constructor(
    private readonly config: FilesystemConfig,
    private readonly logger: pino.Logger
  ) {
    // Resolve all allowed roots to absolute paths at construction time
    this.resolvedRoots = config.allowedRoots.map((root) => path.resolve(root));

    this.logger.debug(
      { allowedRoots: this.resolvedRoots },
      'WatchManager initialized'
    );
  }

  // ============================================================
  // Path Validation Helper
  // ============================================================

  /**
   * Validate and resolve a path
   * @throws WatchError if path is invalid
   */
  private validateAndResolve(inputPath: string): string {
    const result = validatePath(inputPath, this.resolvedRoots);

    if (!result.valid) {
      this.logger.warn(
        { inputPath, error: result.error },
        'Path validation failed'
      );
      throw new WatchError(result.error);
    }

    return result.resolvedPath;
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    this.subscriptionIdCounter++;
    return `watch-${Date.now()}-${this.subscriptionIdCounter}`;
  }

  // ============================================================
  // Subscription Management
  // ============================================================

  /**
   * Subscribe to file system changes for a path
   *
   * @param inputPath - Path to watch (relative or absolute)
   * @param options - Watch options (without path, path is provided separately)
   * @param clientId - Client ID that owns this subscription
   * @returns Subscription ID
   * @throws WatchError if path is invalid or watch fails
   */
  async subscribe(
    inputPath: string,
    options: Omit<WatchOptions, 'path'> = {},
    clientId?: string
  ): Promise<{ subscriptionId: string }> {
    const resolvedPath = this.validateAndResolve(inputPath);

    this.logger.debug(
      { path: resolvedPath, options, clientId },
      'Creating file watch subscription'
    );

    // Check if there's already a subscription for this exact path and options
    const existingSub = this.findExistingSubscription(resolvedPath, options);
    if (existingSub) {
      // Add client to existing subscription
      if (clientId) {
        existingSub.clientIds.add(clientId);
      }
      this.logger.info(
        { subscriptionId: existingSub.id, path: resolvedPath, clientId },
        'Reusing existing subscription'
      );
      return { subscriptionId: existingSub.id };
    }

    const subscriptionId = this.generateSubscriptionId();

    try {
      // Create chokidar watcher
      const watcher = this.createWatcher(resolvedPath, subscriptionId, options);

      // Create subscription record
      const subscription: InternalSubscription = {
        id: subscriptionId,
        options: {
          path: inputPath,
          recursive: options.recursive,
          includes: options.includes,
          excludes: options.excludes,
          ignoreInitial: options.ignoreInitial,
        },
        createdAt: new Date(),
        active: true,
        watcher,
        clientIds: clientId ? new Set([clientId]) : new Set(),
      };

      this.subscriptions.set(subscriptionId, subscription);

      this.logger.info(
        { subscriptionId, path: resolvedPath, clientId },
        'File watch subscription created'
      );

      return { subscriptionId };
    } catch (error) {
      throw new WatchError(
        `Failed to create watch subscription for: ${inputPath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Find existing subscription for the same path and options
   */
  private findExistingSubscription(
    resolvedPath: string,
    options: Omit<WatchOptions, 'path'>
  ): InternalSubscription | null {
    for (const sub of this.subscriptions.values()) {
      const subResolvedPath = this.validateAndResolve(sub.options.path);
      if (
        subResolvedPath === resolvedPath &&
        sub.options.recursive === options.recursive &&
        this.arraysEqual(sub.options.includes, options.includes) &&
        this.arraysEqual(sub.options.excludes, options.excludes)
      ) {
        return sub;
      }
    }
    return null;
  }

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(a?: string[], b?: string[]): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  /**
   * Create a chokidar watcher
   */
  private createWatcher(
    resolvedPath: string,
    subscriptionId: string,
    options: Omit<WatchOptions, 'path'>
  ): chokidar.FSWatcher {
    const watcherOptions: chokidar.WatchOptions = {
      persistent: true,
      ignoreInitial: options.ignoreInitial ?? true,
      followSymlinks: this.config.followSymlinks ?? true,
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    };

    // For non-recursive watching, set up depth limit
    if (options.recursive === false) {
      watcherOptions.depth = 0;
    }

    // Apply exclude patterns
    if (options.excludes && options.excludes.length > 0) {
      watcherOptions.ignored = options.excludes;
    }

    // Create the watcher
    const watcher = chokidar.watch(resolvedPath, watcherOptions);

    // Set up event handlers
    watcher.on('add', (filePath: string) => {
      this.handleWatchEvent(subscriptionId, 'add', filePath);
    });

    watcher.on('change', (filePath: string) => {
      this.handleWatchEvent(subscriptionId, 'change', filePath);
    });

    watcher.on('unlink', (filePath: string) => {
      this.handleWatchEvent(subscriptionId, 'unlink', filePath);
    });

    watcher.on('addDir', (dirPath: string) => {
      this.handleWatchEvent(subscriptionId, 'addDir', dirPath);
    });

    watcher.on('unlinkDir', (dirPath: string) => {
      this.handleWatchEvent(subscriptionId, 'unlinkDir', dirPath);
    });

    watcher.on('error', (error: Error) => {
      this.logger.error(
        { subscriptionId, error: error.message },
        'Watcher error'
      );
    });

    return watcher;
  }

  /**
   * Handle a watch event from chokidar
   */
  private handleWatchEvent(
    subscriptionId: string,
    type: WatchEventType,
    filePath: string
  ): void {
    const event: WatchEvent = {
      subscriptionId,
      type,
      path: filePath,
      timestamp: new Date(),
    };

    this.logger.debug(
      { subscriptionId, type, path: filePath },
      'Watch event received'
    );

    if (this.eventHandler) {
      try {
        this.eventHandler(event);
      } catch (error) {
        this.logger.error(
          { subscriptionId, error: error instanceof Error ? error.message : String(error) },
          'Error in watch event handler'
        );
      }
    }
  }

  /**
   * Unsubscribe from file system changes
   *
   * @param subscriptionId - Subscription ID to unsubscribe
   * @param clientId - Optional client ID (only remove if this client owns it)
   * @throws WatchError if subscription not found
   */
  async unsubscribe(subscriptionId: string, clientId?: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new WatchError(`Subscription not found: ${subscriptionId}`);
    }

    // If clientId provided, only remove this client's ownership
    if (clientId) {
      subscription.clientIds.delete(clientId);

      // If there are still other clients using this subscription, don't close it
      if (subscription.clientIds.size > 0) {
        this.logger.debug(
          { subscriptionId, clientId, remainingClients: subscription.clientIds.size },
          'Removed client from subscription, but subscription still active'
        );
        return;
      }
    }

    // Close the watcher
    try {
      await subscription.watcher.close();
      this.logger.info({ subscriptionId }, 'Watcher closed');
    } catch (error) {
      this.logger.error(
        { subscriptionId, error: error instanceof Error ? error.message : String(error) },
        'Error closing watcher'
      );
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    this.logger.info({ subscriptionId }, 'Subscription removed');
  }

  /**
   * Unsubscribe all subscriptions for a client
   *
   * @param clientId - Client ID to clean up subscriptions for
   */
  async unsubscribeClient(clientId: string): Promise<void> {
    const subscriptionsToRemove: string[] = [];

    for (const [subscriptionId, subscription] of this.subscriptions) {
      if (subscription.clientIds.has(clientId)) {
        subscriptionsToRemove.push(subscriptionId);
      }
    }

    for (const subscriptionId of subscriptionsToRemove) {
      await this.unsubscribe(subscriptionId, clientId);
    }

    this.logger.info(
      { clientId, count: subscriptionsToRemove.length },
      'Cleaned up client subscriptions'
    );
  }

  /**
   * List all active subscriptions
   *
   * @returns Array of subscriptions
   */
  async list(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).map((sub) => ({
      id: sub.id,
      options: sub.options,
      createdAt: sub.createdAt,
      active: sub.active,
    }));
  }

  /**
   * Get a subscription by ID
   *
   * @param subscriptionId - Subscription ID
   * @returns Subscription or undefined
   */
  getSubscription(subscriptionId: string): Subscription | undefined {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return undefined;

    return {
      id: sub.id,
      options: sub.options,
      createdAt: sub.createdAt,
      active: sub.active,
    };
  }

  /**
   * Set the event handler for watch events
   *
   * @param handler - Event handler function
   */
  setEventHandler(handler: WatchEventHandler): void {
    this.eventHandler = handler;
    this.logger.debug('Watch event handler set');
  }

  /**
   * Get the number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Close all subscriptions
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.subscriptions.keys()).map((id) =>
      this.unsubscribe(id)
    );

    await Promise.all(closePromises);

    this.logger.info('All subscriptions closed');
  }
}
