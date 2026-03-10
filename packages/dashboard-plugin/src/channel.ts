/**
 * Dashboard Channel Plugin
 */

import type { OpenClawConfig, ChatType } from './openclaw-sdk.js';
import type { ResolvedDashboardAccount } from './types.js';
import { DEFAULT_ACCOUNT_ID, listDashboardAccountIds, resolveDashboardAccount } from './config.js';
import { startDashboardGateway } from './gateway.js';
import { sendText, sendMedia } from './outbound.js';

export const dashboardPlugin = {
  id: 'dashboard',
  meta: {
    id: 'dashboard',
    label: 'Dashboard',
    selectionLabel: 'Dashboard Web Chat',
    docsPath: '/docs/channels/dashboard',
    blurb: 'Connect Openclaw to Dashboard for web-based chat interface',
    order: 10,
  },
  capabilities: {
    chatTypes: ['direct'] as ChatType[],
    media: true,
    reactions: false,
    threads: false,
    blockStreaming: false, // Support streaming
  },
  reload: { configPrefixes: ['channels.dashboard'] },

  config: {
    listAccountIds: (cfg: OpenClawConfig): string[] => {
      return listDashboardAccountIds(cfg);
    },
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null): ResolvedDashboardAccount => {
      return resolveDashboardAccount(cfg, accountId);
    },
    defaultAccountId: (cfg: OpenClawConfig): string => {
      const ids = listDashboardAccountIds(cfg);
      return ids.length > 0 ? ids[0] : DEFAULT_ACCOUNT_ID;
    },
    isConfigured: (account: ResolvedDashboardAccount | undefined): boolean => {
      return Boolean(account?.backendUrl);
    },
    describeAccount: (account: ResolvedDashboardAccount | undefined) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name,
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.backendUrl),
    }),
  },

  messaging: {
    normalizeTarget: (target: string) => {
      // Support formats:
      // - dashboard:conversation:xxx
      // - conversation:xxx
      // - conv_xxx (assumed conversation ID)
      const id = target.replace(/^dashboard:/i, '');

      if (id.startsWith('conversation:')) {
        return { ok: true, to: `dashboard:${id}` };
      }

      if (id.startsWith('conv_')) {
        return { ok: true, to: `dashboard:conversation:${id}` };
      }

      return { ok: true, to: `dashboard:conversation:${id}` };
    },
    targetResolver: {
      looksLikeId: (id: string): boolean => {
        return (
          /^dashboard:/.test(id) ||
          /^conversation:/.test(id) ||
          /^conv_[a-zA-Z0-9]+$/.test(id)
        );
      },
      hint: 'Dashboard 目标格式: dashboard:conversation:conv_xxx',
    },
  },

  outbound: {
    deliveryMode: 'direct' as const,
    textChunkLimit: 4000,
    sendText: async (ctx: {
      to: string;
      text: string;
      accountId?: string;
      replyToId?: string;
      cfg: OpenClawConfig;
    }) => {
      const account = resolveDashboardAccount(ctx.cfg, ctx.accountId);
      const result = await sendText({
        to: ctx.to,
        text: ctx.text,
        account,
        replyToId: ctx.replyToId,
      });
      return {
        channel: 'dashboard',
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
    sendMedia: async (ctx: {
      to: string;
      text?: string;
      mediaUrl?: string;
      accountId?: string;
      replyToId?: string;
      cfg: OpenClawConfig;
    }) => {
      const account = resolveDashboardAccount(ctx.cfg, ctx.accountId);
      const result = await sendMedia({
        to: ctx.to,
        text: ctx.text,
        mediaUrl: ctx.mediaUrl || '',
        account,
        replyToId: ctx.replyToId,
      });
      return {
        channel: 'dashboard',
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },

  gateway: {
    startAccount: async (ctx: {
      account: ResolvedDashboardAccount;
      accountId: string;
      abortSignal: AbortSignal;
      cfg: OpenClawConfig;
      log?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
        debug: (msg: string) => void;
      };
      getStatus: () => Record<string, unknown>;
      setStatus: (status: Record<string, unknown>) => void;
    }) => {
      const { account, abortSignal, log } = ctx;

      log?.info(`[dashboard:${account.accountId}] Starting gateway`);

      await startDashboardGateway({
        account,
        abortSignal,
        log,
        onReady: () => {
          log?.info(`[dashboard:${account.accountId}] Gateway ready`);
          ctx.setStatus({
            ...ctx.getStatus(),
            running: true,
            connected: true,
            lastConnectedAt: Date.now(),
          });
        },
        onError: (error) => {
          log?.error(`[dashboard:${account.accountId}] Gateway error: ${error.message}`);
          ctx.setStatus({
            ...ctx.getStatus(),
            lastError: error.message,
          });
        },
      });
    },
  },
};
