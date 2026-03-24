/**
 * FE-02: 规则状态管理
 *
 * 文件：apps/web/src/stores/ruleStore.ts
 */

import { create } from 'zustand';
import { rulesApi } from '@/lib/api';

// 类型定义
export interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string | null;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  template?: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}

interface RuleState {
  rules: Rule[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRules: (enabled?: boolean) => Promise<void>;
  createRule: (data: CreateRuleInput) => Promise<Rule>;
  updateRule: (id: string, data: UpdateRuleInput) => Promise<Rule>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string, enabled: boolean) => Promise<void>;
}

export const useRuleStore = create<RuleState>((set, get) => ({
  rules: [],
  isLoading: false,
  error: null,

  fetchRules: async (enabled?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const response = await rulesApi.list(enabled);
      if (!response.ok) throw new Error('Failed to fetch rules');
      const rules = await response.json();
      set({ rules, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createRule: async (data: CreateRuleInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await rulesApi.create(data);
      if (!response.ok) throw new Error('Failed to create rule');
      const newRule = await response.json();
      set((state) => ({
        rules: [...state.rules, newRule],
        isLoading: false,
      }));
      return newRule;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updateRule: async (id: string, data: UpdateRuleInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await rulesApi.update(id, data);
      if (!response.ok) throw new Error('Failed to update rule');
      const updatedRule = await response.json();
      set((state) => ({
        rules: state.rules.map((rule) =>
          rule.id === id ? updatedRule : rule
        ),
        isLoading: false,
      }));
      return updatedRule;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deleteRule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await rulesApi.delete(id);
      if (!response.ok) throw new Error('Failed to delete rule');
      set((state) => ({
        rules: state.rules.filter((rule) => rule.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  toggleRule: async (id: string, enabled: boolean) => {
    set({ error: null });
    try {
      const response = await rulesApi.toggle(id, enabled);
      if (!response.ok) throw new Error('Failed to toggle rule');
      const updatedRule = await response.json();
      set((state) => ({
        rules: state.rules.map((rule) =>
          rule.id === id ? updatedRule : rule
        ),
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },
}));
