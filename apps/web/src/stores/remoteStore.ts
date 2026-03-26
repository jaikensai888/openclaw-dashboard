// apps/web/src/stores/remoteStore.ts
import { create } from 'zustand';

export interface RemoteServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  remotePort: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

interface RemoteState {
  servers: RemoteServer[];
  activeServerId: string | null;
  managerExpanded: boolean;
  isLoading: boolean;

  // Actions
  loadServers: () => Promise<void>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  switchServer: (id: string | null) => void;
  addServer: (config: Omit<RemoteServer, 'id' | 'status'>) => Promise<void>;
  updateServer: (id: string, config: Partial<RemoteServer>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  toggleManager: () => void;
  setServerStatus: (id: string, status: RemoteServer['status'], error?: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

export const useRemoteStore = create<RemoteState>((set, get) => ({
  servers: [],
  activeServerId: null,
  managerExpanded: false,
  isLoading: false,

  loadServers: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/remote/servers`);
      const data = await res.json();
      if (data.success) {
        set({ servers: data.data });
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  connectServer: async (id) => {
    const { servers } = get();
    set({
      servers: servers.map((s) =>
        s.id === id ? { ...s, status: 'connecting' as const } : s
      ),
    });

    try {
      const res = await fetch(`${API_BASE}/remote/servers/${id}/connect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, status: 'connected' as const } : s
          ),
        });
      } else {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, status: 'error' as const, error: data.error } : s
          ),
        });
      }
    } catch (error) {
      set({
        servers: get().servers.map((s) =>
          s.id === id ? { ...s, status: 'error' as const, error: String(error) } : s
        ),
      });
    }
  },

  disconnectServer: async (id) => {
    try {
      await fetch(`${API_BASE}/remote/servers/${id}/disconnect`, {
        method: 'POST',
      });
      set({
        servers: get().servers.map((s) =>
          s.id === id ? { ...s, status: 'disconnected' as const } : s
        ),
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  },

  switchServer: (id) => {
    set({ activeServerId: id });
    // 通知后端
    fetch(`${API_BASE}/remote/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: id }),
    }).catch(console.error);
  },

  addServer: async (config) => {
    try {
      const res = await fetch(`${API_BASE}/remote/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        set({ servers: [...get().servers, { ...data.data, status: 'disconnected' as const }] });
      }
    } catch (error) {
      console.error('Failed to add server:', error);
    }
  },

  updateServer: async (id, config) => {
    try {
      const res = await fetch(`${API_BASE}/remote/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, ...data.data } : s
          ),
        });
      }
    } catch (error) {
      console.error('Failed to update server:', error);
    }
  },

  removeServer: async (id) => {
    try {
      await fetch(`${API_BASE}/remote/servers/${id}`, {
        method: 'DELETE',
      });
      set({
        servers: get().servers.filter((s) => s.id !== id),
        activeServerId: get().activeServerId === id ? null : get().activeServerId,
      });
    } catch (error) {
      console.error('Failed to remove server:', error);
    }
  },

  toggleManager: () => {
    set({ managerExpanded: !get().managerExpanded });
  },

  setServerStatus: (id, status, error) => {
    set({
      servers: get().servers.map((s) =>
        s.id === id ? { ...s, status, error } : s
      ),
    });
  },
}));
