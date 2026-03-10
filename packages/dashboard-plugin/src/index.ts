/**
 * Openclaw Dashboard Plugin
 *
 * Connects Openclaw to Dashboard Backend for web-based chat interface
 */

import type { OpenClawPluginApi, PluginRuntime } from './openclaw-sdk.js';
import { dashboardPlugin } from './channel.js';
import { setDashboardRuntime, getDashboardRuntime } from './runtime.js';

interface DashboardPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  register(api: OpenClawPluginApi): void;
  start(runtime: PluginRuntime): void;
}

const plugin: DashboardPlugin = {
  id: 'dashboard',
  name: 'Dashboard Channel',
  description: 'Connect Openclaw to Dashboard Backend for web-based chat interface',
  version: '1.0.0',

  register(api: OpenClawPluginApi) {
    setDashboardRuntime(api.runtime);
    api.registerChannel({ plugin: dashboardPlugin });
  },

  start(runtime: PluginRuntime) {
    setDashboardRuntime(runtime);
  },
};

export default plugin;

// Export plugin components
export { dashboardPlugin } from './channel.js';
export { startDashboardGateway, sendToDashboard, sendAgentMessage, sendAgentStreaming, sendAgentMessageDone, sendAgentMedia } from './gateway.js';
export { sendText, sendMedia, sendStreamingText, sendStreamingDone } from './outbound.js';
export { listDashboardAccountIds, resolveDashboardAccount, applyDashboardAccountConfig } from './config.js';
export { setDashboardRuntime, getDashboardRuntime } from './runtime.js';
export type { DashboardAccountConfig, ResolvedDashboardAccount } from './types.js';
