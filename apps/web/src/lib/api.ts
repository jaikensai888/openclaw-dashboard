/**
 * API configuration
 * 端口配置统一在根目录 .env 的 SERVER_PORT
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

/**
 * Helper function to build API URLs
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// ============================================
// Rules API
// ============================================

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string[];
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
  isEnabled?: boolean;
  priority?: number;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  template?: string;
  variables?: string[];
  isEnabled?: boolean;
  priority?: number;
}

export const rulesApi = {
  list: async (enabled?: boolean): Promise<Rule[]> => {
    const url = enabled !== undefined
      ? apiUrl(`/rules?enabled=${enabled}`)
      : apiUrl('/rules');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch rules');
    return response.json();
  },

  get: async (id: string): Promise<Rule> => {
    const response = await fetch(apiUrl(`/rules/${id}`));
    if (!response.ok) throw new Error('Failed to fetch rule');
    return response.json();
  },

  create: async (input: CreateRuleInput): Promise<Rule> => {
    const response = await fetch(apiUrl('/rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create rule');
    const data = await response.json();
    return data.data;
  },

  update: async (id: string, input: UpdateRuleInput): Promise<Rule> => {
    const response = await fetch(apiUrl(`/rules/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to update rule');
    const data = await response.json();
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(apiUrl(`/rules/${id}`), {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete rule');
  },

  toggle: async (id: string, enabled: boolean): Promise<Rule> => {
    const response = await fetch(apiUrl(`/rules/${id}/toggle`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) throw new Error('Failed to toggle rule');
    const data = await response.json();
    return data.data;
  },
};
