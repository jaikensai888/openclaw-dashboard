/**
 * Dashboard Plugin Outbound
 * Handles sending messages from Openclaw to Dashboard
 */

import type { ResolvedDashboardAccount } from './types.js';
import { sendAgentMessage, sendAgentStreaming, sendAgentMessageDone, sendAgentMedia, isAuthenticated } from './gateway.js';

export interface SendTextOptions {
  to: string;
  text: string;
  account: ResolvedDashboardAccount;
  replyToId?: string;
}

export interface SendMediaOptions {
  to: string;
  text?: string;
  mediaUrl: string;
  account: ResolvedDashboardAccount;
  replyToId?: string;
}

export interface StreamingOptions {
  to: string;
  delta?: string;
  account: ResolvedDashboardAccount;
}

/**
 * Send text message to Dashboard
 */
export async function sendText(options: SendTextOptions): Promise<{ messageId: string; error?: string }> {
  const { to, text, account } = options;

  if (!isAuthenticated(account.accountId)) {
    return { messageId: '', error: 'Not connected to Dashboard' };
  }

  const conversationId = extractConversationId(to);
  const success = sendAgentMessage(account.accountId, conversationId, text);

  if (success) {
    return { messageId: `msg_${Date.now()}` };
  }
  return { messageId: '', error: 'Failed to send message' };
}

/**
 * Send media message to Dashboard
 */
export async function sendMedia(options: SendMediaOptions): Promise<{ messageId: string; error?: string }> {
  const { to, text, mediaUrl, account } = options;

  if (!isAuthenticated(account.accountId)) {
    return { messageId: '', error: 'Not connected to Dashboard' };
  }

  const conversationId = extractConversationId(to);
  const success = sendAgentMedia(account.accountId, conversationId, { text, mediaUrl });

  if (success) {
    return { messageId: `msg_${Date.now()}` };
  }
  return { messageId: '', error: 'Failed to send media' };
}

/**
 * Send streaming text delta
 */
export function sendStreamingText(options: StreamingOptions): boolean {
  const { to, delta, account } = options;
  if (!isAuthenticated(account.accountId)) return false;

  const conversationId = extractConversationId(to);
  return sendAgentStreaming(account.accountId, conversationId, delta || '');
}

/**
 * Send streaming complete signal
 */
export function sendStreamingDone(options: StreamingOptions): boolean {
  const { to, account } = options;
  if (!isAuthenticated(account.accountId)) return false;

  const conversationId = extractConversationId(to);
  return sendAgentMessageDone(account.accountId, conversationId);
}

/**
 * Extract conversation ID from target string
 */
function extractConversationId(to: string): string {
  let id = to.replace(/^dashboard:/i, '');
  if (id.startsWith('conversation:')) {
    id = id.substring('conversation:'.length);
  }
  return id;
}
