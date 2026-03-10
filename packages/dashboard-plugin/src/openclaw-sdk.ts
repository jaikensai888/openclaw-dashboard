/**
 * Openclaw Plugin SDK Type Definitions
 *
 * This file provides type definitions for the Openclaw Plugin SDK.
 * In production, these would be imported from 'openclaw/plugin-sdk'.
 */

// Configuration types
export interface OpenClawConfig {
  channels?: {
    [key: string]: unknown;
    dashboard?: unknown;
  };
  [key: string]: unknown;
}

// Channel types
export type ChatType = 'direct' | 'group' | 'channel';

export interface ChannelPluginMeta {
  id: string;
  label: string;
  selectionLabel?: string;
  docsPath?: string;
  blurb?: string;
  order?: number;
}

export interface ChannelPluginCapabilities {
  chatTypes?: ChatType[];
  media?: boolean;
  reactions?: boolean;
  threads?: boolean;
  blockStreaming?: boolean;
}

export interface ChannelOnboardingStatus {
  channel?: string;
  configured: boolean;
  statusLines?: string[];
  selectionHint?: string;
}

export interface ChannelOnboardingResult {
  success: boolean;
  config?: OpenClawConfig;
  error?: string;
  message?: string;
}

export interface SendTextResult {
  channel: string;
  messageId?: string;
  error?: Error;
}

// Gateway context
export interface GatewayStartContext<TAccount = unknown> {
  account: TAccount;
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
}

// Plugin runtime
export interface PluginRuntime {
  getConfig(): OpenClawConfig;
  setConfig(config: OpenClawConfig): void;
  getDataDir(): string;
  log: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
  // Channel interface for message injection
  channel?: {
    handleIncomingMessage?: (options: {
      channel: string;
      to: string;
      from: string;
      content: string;
      messageId: string;
      timestamp: number;
      metadata?: Record<string, unknown>;
    }) => Promise<void> | void;
    deliver?: (ctx: unknown) => Promise<unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Plugin API
export interface OpenClawPluginApi {
  runtime: PluginRuntime;
  registerChannel<TAccount = unknown>(options: { plugin: ChannelPlugin<TAccount> }): void;
}

// Channel Plugin
export interface ChannelPlugin<TAccount = unknown> {
  id: string;
  meta?: ChannelPluginMeta;
  version?: string;
  capabilities?: ChannelPluginCapabilities;
  reload?: { configPrefixes?: string[] };

  config?: {
    listAccountIds: (cfg: OpenClawConfig) => string[];
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) => TAccount;
    defaultAccountId: (cfg: OpenClawConfig) => string;
    setAccountEnabled?: (ctx: { cfg: OpenClawConfig; accountId: string; enabled: boolean }) => OpenClawConfig;
    deleteAccount?: (ctx: { cfg: OpenClawConfig; accountId: string }) => OpenClawConfig;
    isConfigured?: (account: TAccount | undefined) => boolean;
    describeAccount?: (account: TAccount | undefined) => {
      accountId: string;
      name?: string;
      enabled: boolean;
      configured: boolean;
    };
  };

  setup?: {
    resolveAccountId?: (ctx: { accountId?: string }) => string;
    applyAccountName?: (ctx: { cfg: OpenClawConfig; accountId: string; name: string }) => OpenClawConfig;
    validateInput?: (ctx: { input: Record<string, unknown> }) => string | null;
    applyAccountConfig?: (ctx: {
      cfg: OpenClawConfig;
      accountId: string;
      input: Record<string, unknown>;
    }) => OpenClawConfig;
  };

  messaging?: {
    normalizeTarget?: (target: string) => { ok: boolean; to?: string; error?: string };
    targetResolver?: {
      looksLikeId?: (id: string) => boolean;
      hint?: string;
    };
  };

  outbound?: {
    deliveryMode?: 'direct' | 'queued';
    chunker?: (text: string, limit: number) => string[];
    chunkerMode?: 'markdown' | 'plain';
    textChunkLimit?: number;
    sendText?: (ctx: {
      to: string;
      text: string;
      accountId?: string;
      replyToId?: string;
      cfg: OpenClawConfig;
    }) => Promise<SendTextResult>;
    sendMedia?: (ctx: {
      to: string;
      text?: string;
      mediaUrl?: string;
      accountId?: string;
      replyToId?: string;
      cfg: OpenClawConfig;
    }) => Promise<SendTextResult>;
  };

  gateway?: {
    startAccount?: (ctx: GatewayStartContext<TAccount>) => Promise<void>;
  };

  start?: (runtime: PluginRuntime) => void | Promise<void>;
  stop?: () => void | Promise<void>;
}

// SDK functions
export function emptyPluginConfigSchema(): unknown {
  return { type: 'object', additionalProperties: false, properties: {} };
}

export function applyAccountNameToChannelSection(ctx: {
  cfg: OpenClawConfig;
  channelKey: string;
  accountId: string;
  name: string;
}): OpenClawConfig {
  const { cfg, channelKey, accountId, name } = ctx;
  const next = { ...cfg };

  if (accountId === 'default') {
    next.channels = {
      ...next.channels,
      [channelKey]: {
        ...(next.channels?.[channelKey] as Record<string, unknown> || {}),
        name,
      },
    };
  } else {
    const channel = next.channels?.[channelKey] as Record<string, unknown> | undefined;
    next.channels = {
      ...next.channels,
      [channelKey]: {
        ...channel,
        accounts: {
          ...((channel?.accounts as Record<string, unknown>) || {}),
          [accountId]: {
            ...((channel?.accounts as Record<string, unknown>)?.[accountId] as Record<string, unknown> || {}),
            name,
          },
        },
      },
    };
  }

  return next;
}

export function deleteAccountFromConfigSection(ctx: {
  cfg: OpenClawConfig;
  sectionKey: string;
  accountId: string;
  clearBaseFields?: string[];
}): OpenClawConfig {
  const { cfg, sectionKey, accountId, clearBaseFields = [] } = ctx;
  const next = { ...cfg };
  const section = next.channels?.[sectionKey] as Record<string, unknown> | undefined;

  if (!section) return next;

  if (accountId === 'default') {
    const cleaned = { ...section };
    for (const field of clearBaseFields) {
      delete cleaned[field];
    }
    next.channels = { ...next.channels, [sectionKey]: cleaned };
  } else {
    const accounts = { ...(section.accounts as Record<string, unknown> || {}) };
    delete accounts[accountId];
    next.channels = {
      ...next.channels,
      [sectionKey]: { ...section, accounts },
    };
  }

  return next;
}

export const DEFAULT_ACCOUNT_ID = 'default';

export function normalizeAccountId(accountId: string | undefined | null): string {
  return accountId?.trim().toLowerCase() || DEFAULT_ACCOUNT_ID;
}
