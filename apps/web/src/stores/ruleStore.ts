/**
 * Rule Store
 *
 * 规则状态管理
 */

import { create } from 'zustand';
import { rulesApi, type Rule, type CreateRuleInput, type UpdateRuleInput } from '@/lib/api';

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
  clearError: () => void;
}

export const useRuleStore = create<RuleState>((set, get) => ({
  rules: [],
  isLoading: false,
  error: null,

  fetchRules: async (enabled?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const rules = await rulesApi.list(enabled);
      set({ rules, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createRule: async (data: CreateRuleInput) => {
    set({ isLoading: true, error: null });
    try {
      const newRule = await rulesApi.create(data);
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
      const updatedRule = await rulesApi.update(id, data);
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
      await rulesApi.delete(id);
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
      const updatedRule = await rulesApi.toggle(id, enabled);
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

  clearError: () => set({ error: null }),
}));
