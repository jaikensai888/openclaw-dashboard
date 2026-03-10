/**
 * Runtime storage for Dashboard plugin
 */

import type { PluginRuntime } from './openclaw-sdk.js';

let runtime: PluginRuntime | null = null;

export function setDashboardRuntime(r: PluginRuntime): void {
  runtime = r;
}

export function getDashboardRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error('Dashboard runtime not initialized');
  }
  return runtime;
}

export function hasRuntime(): boolean {
  return runtime !== null;
}
