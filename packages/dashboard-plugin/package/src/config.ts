/**
 * Dashboard Plugin Configuration
 */

import type { OpenClawConfig } from './openclaw-sdk.js';
import type { DashboardAccountConfig, ResolvedDashboardAccount } from './types.js';

export const DEFAULT_ACCOUNT_ID = 'default';

interface DashboardChannelConfig extends DashboardAccountConfig {
  accounts?: Record<string, DashboardAccountConfig>;
}

interface OpenclawPluginsConfig {
  plugins?: {
    entries?: {
      'dashboard-plugin'?: {
        enabled?: boolean;
        config?: DashboardAccountConfig;
      };
      [key: string]: unknown;
    };
  };
  channels?: {
    dashboard?: DashboardChannelConfig;
    [key: string]: unknown;
  };
}

/**
 * Get plugin-level config from Openclaw plugins.entries.dashboard-plugin.config
 */
function getPluginLevelConfig(cfg: OpenClawConfig): DashboardAccountConfig | undefined {
  const config = cfg as unknown as OpenclawPluginsConfig;
  return config.plugins?.entries?.['dashboard-plugin']?.config;
}

/**
 * List all Dashboard account IDs
 */
export function listDashboardAccountIds(cfg: OpenClawConfig): string[] {
  const ids = new Set<string>();

  // Check plugin-level config first (Openclaw plugin system)
  const pluginConfig = getPluginLevelConfig(cfg);
  if (pluginConfig?.backendUrl) {
    ids.add(DEFAULT_ACCOUNT_ID);
    return Array.from(ids);
  }

  // Fallback to channel config
  const dashboard = cfg.channels?.dashboard as DashboardChannelConfig | undefined;

  if (dashboard?.backendUrl) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }

  if (dashboard?.accounts) {
    for (const accountId of Object.keys(dashboard.accounts)) {
      if (dashboard.accounts[accountId]?.backendUrl) {
        ids.add(accountId);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Resolve Dashboard account configuration
 */
export function resolveDashboardAccount(
  cfg: OpenClawConfig,
  accountId?: string | null
): ResolvedDashboardAccount {
  const resolvedAccountId = accountId ?? DEFAULT_ACCOUNT_ID;

  // Check plugin-level config first (Openclaw plugin system)
  const pluginConfig = getPluginLevelConfig(cfg);
  if (pluginConfig?.backendUrl && resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    return {
      accountId: resolvedAccountId,
      name: pluginConfig.name,
      enabled: true,
      backendUrl: pluginConfig.backendUrl || process.env.DASHBOARD_BACKEND_URL || '',
      pluginToken: pluginConfig.pluginToken || process.env.DASHBOARD_PLUGIN_TOKEN,
      config: pluginConfig,
    };
  }

  // Fallback to channel config
  const dashboard = cfg.channels?.dashboard as DashboardChannelConfig | undefined;

  let accountConfig: DashboardAccountConfig = {};

  if (resolvedAccountId === DEFAULT_ACCOUNT_ID) {
    accountConfig = {
      enabled: dashboard?.enabled,
      name: dashboard?.name,
      backendUrl: dashboard?.backendUrl,
      pluginToken: dashboard?.pluginToken,
    };
  } else {
    const account = dashboard?.accounts?.[resolvedAccountId];
    accountConfig = account ?? {};
  }

  return {
    accountId: resolvedAccountId,
    name: accountConfig.name,
    enabled: accountConfig.enabled !== false,
    backendUrl: accountConfig.backendUrl || process.env.DASHBOARD_BACKEND_URL || '',
    pluginToken: accountConfig.pluginToken || process.env.DASHBOARD_PLUGIN_TOKEN,
    config: accountConfig,
  };
}

/**
 * Apply Dashboard account configuration
 */
export function applyDashboardAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
  input: {
    backendUrl?: string;
    pluginToken?: string;
    name?: string;
  }
): OpenClawConfig {
  const next = { ...cfg } as unknown as OpenclawPluginsConfig;

  // Check if using plugin-level config (Openclaw plugin system)
  const pluginConfig = next.plugins?.entries?.['dashboard-plugin']?.config;
  if (pluginConfig && accountId === DEFAULT_ACCOUNT_ID) {
    next.plugins = {
      ...next.plugins,
      entries: {
        ...next.plugins?.entries,
        'dashboard-plugin': {
          ...next.plugins?.entries?.['dashboard-plugin'],
          enabled: true,
          config: {
            ...pluginConfig,
            ...(input.backendUrl ? { backendUrl: input.backendUrl } : {}),
            ...(input.pluginToken ? { pluginToken: input.pluginToken } : {}),
            ...(input.name ? { name: input.name } : {}),
          },
        },
      },
    };
    return next as unknown as OpenClawConfig;
  }

  // Fallback to channel config
  if (accountId === DEFAULT_ACCOUNT_ID) {
    next.channels = {
      ...next.channels,
      dashboard: {
        ...(next.channels?.dashboard as Record<string, unknown> || {}),
        enabled: true,
        ...(input.backendUrl ? { backendUrl: input.backendUrl } : {}),
        ...(input.pluginToken ? { pluginToken: input.pluginToken } : {}),
        ...(input.name ? { name: input.name } : {}),
      },
    };
  } else {
    const dashboard = next.channels?.dashboard as DashboardChannelConfig || {};
    next.channels = {
      ...next.channels,
      dashboard: {
        ...dashboard,
        enabled: true,
        accounts: {
          ...dashboard.accounts,
          [accountId]: {
            ...dashboard.accounts?.[accountId],
            enabled: true,
            ...(input.backendUrl ? { backendUrl: input.backendUrl } : {}),
            ...(input.pluginToken ? { pluginToken: input.pluginToken } : {}),
            ...(input.name ? { name: input.name } : {}),
          },
        },
      },
    };
  }

  return next as unknown as OpenClawConfig;
}
