/**
 * Message Queue Manager
 *
 * Manages message processing for multiple conversations in parallel.
 * Each conversation has its own queue, allowing independent processing
 * without blocking other conversations.
 */

import type { GatewayOptions } from './gateway.js';

interface QueuedMessage {
  accountId: string;
  conversationId: string;
  content: string;
  messageId: string;
  timestamp: number;
}

interface ConversationQueue {
  messages: QueuedMessage[];
  isProcessing: boolean;
  abortController?: AbortController;
}

interface MessageProcessor {
  (
    message: QueuedMessage,
    options: {
      log: GatewayOptions['log'];
      abortSignal: AbortSignal;
    }
  ): Promise<void>;
}

class MessageQueueManager {
  private queues: Map<string, ConversationQueue> = new Map();
  private processor: MessageProcessor | null = null;
  private log: GatewayOptions['log'];

  constructor(log?: GatewayOptions['log']) {
    this.log = log || {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  }

  /**
   * Set the message processor function
   */
  setProcessor(processor: MessageProcessor): void {
    this.processor = processor;
  }

  /**
   * Enqueue a message for processing
   * Returns immediately, processing happens asynchronously
   */
  enqueue(message: QueuedMessage): void {
    const { conversationId } = message;
    this.log?.info(`[Queue] Enqueueing message for conversation: ${conversationId}`);

    // Get or create queue for this conversation
    let queue = this.queues.get(conversationId);
    if (!queue) {
      queue = {
        messages: [],
        isProcessing: false,
      };
      this.queues.set(conversationId, queue);
    }

    // Add message to queue
    queue.messages.push(message);

    // Start processing if not already
    this.processQueue(conversationId);
  }

  /**
   * Process messages in a conversation's queue
   */
  private async processQueue(conversationId: string): Promise<void> {
    const queue = this.queues.get(conversationId);
    if (!queue) return;

    // Already processing, will continue after current message
    if (queue.isProcessing) {
      this.log?.debug(`[Queue] Already processing conversation: ${conversationId}`);
      return;
    }

    // No messages to process
    if (queue.messages.length === 0) {
      this.log?.debug(`[Queue] No messages for conversation: ${conversationId}`);
      return;
    }

    if (!this.processor) {
      this.log?.error(`[Queue] No processor set for conversation: ${conversationId}`);
      return;
    }

    queue.isProcessing = true;
    queue.abortController = new AbortController();

    try {
      // Process messages one by one in this conversation
      while (queue.messages.length > 0) {
        // Check if aborted
        if (queue.abortController.signal.aborted) {
          this.log?.info(`[Queue] Processing aborted for conversation: ${conversationId}`);
          break;
        }

        const message = queue.messages.shift();
        if (!message) break;

        this.log?.info(
          `[Queue] Processing message ${message.messageId} for conversation: ${conversationId}`
        );

        try {
          await this.processor(message, {
            log: this.log,
            abortSignal: queue.abortController.signal,
          });
        } catch (err) {
          this.log?.error(
            `[Queue] Error processing message ${message.messageId}:`,
            err instanceof Error ? err.message : err
          );
          // Continue processing next message even if this one failed
        }
      }
    } finally {
      queue.isProcessing = false;
      queue.abortController = undefined;

      // Clean up empty queues
      if (queue.messages.length === 0) {
        this.queues.delete(conversationId);
      }
    }
  }

  /**
   * Cancel processing for a specific conversation
   */
  cancel(conversationId: string): boolean {
    const queue = this.queues.get(conversationId);
    if (!queue) return false;

    if (queue.abortController) {
      queue.abortController.abort();
      this.log?.info(`[Queue] Cancelled processing for conversation: ${conversationId}`);
    }

    // Clear pending messages
    queue.messages = [];

    return true;
  }

  /**
   * Get queue status for a conversation
   */
  getStatus(conversationId: string): {
    pending: number;
    isProcessing: boolean;
  } | null {
    const queue = this.queues.get(conversationId);
    if (!queue) return null;

    return {
      pending: queue.messages.length,
      isProcessing: queue.isProcessing,
    };
  }

  /**
   * Get overall queue statistics
   */
  getStats(): {
    totalQueues: number;
    totalPending: number;
    activeConversations: string[];
  } {
    let totalPending = 0;
    const activeConversations: string[] = [];

    for (const [conversationId, queue] of this.queues) {
      totalPending += queue.messages.length;
      if (queue.isProcessing) {
        activeConversations.push(conversationId);
      }
    }

    return {
      totalQueues: this.queues.size,
      totalPending,
      activeConversations,
    };
  }

  /**
   * Shutdown all queues
   */
  shutdown(): void {
    this.log?.info('[Queue] Shutting down all queues');

    for (const [conversationId, queue] of this.queues) {
      if (queue.abortController) {
        queue.abortController.abort();
      }
      queue.messages = [];
    }

    this.queues.clear();
  }
}

// Singleton instance
let queueManager: MessageQueueManager | null = null;

export function getMessageQueue(log?: GatewayOptions['log']): MessageQueueManager {
  if (!queueManager) {
    queueManager = new MessageQueueManager(log);
  }
  return queueManager;
}

export function shutdownMessageQueue(): void {
  if (queueManager) {
    queueManager.shutdown();
    queueManager = null;
  }
}

export type { QueuedMessage, MessageProcessor, MessageQueueManager };
