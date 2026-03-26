// apps/web/src/stores/fileStore.ts
import { create } from 'zustand';
import { useRemoteStore } from './remoteStore';

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

interface FileState {
  currentPath: string;
  files: FileInfo[];
  selectedFile: string | null;
  fileContent: string | null;
  isLoading: boolean;
  error: string | null;
  pathHistory: string[];

  // Actions
  listDirectory: (path: string, wsSend: (type: string, payload: unknown) => void) => void;
  readFile: (path: string, wsSend: (type: string, payload: unknown) => void) => void;
  refresh: (wsSend: (type: string, payload: unknown) => void) => void;
  goBack: (wsSend: (type: string, payload: unknown) => void) => void;
  setSelectedFile: (path: string | null) => void;
  setFiles: (files: FileInfo[]) => void;
  setFileContent: (content: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '/',
  files: [],
  selectedFile: null,
  fileContent: null,
  isLoading: false,
  error: null,
  pathHistory: [],

  listDirectory: (path, wsSend) => {
    const activeServerId = useRemoteStore.getState().activeServerId;
    if (!activeServerId) {
      set({ error: '请先连接远程服务器' });
      return;
    }

    set({ isLoading: true, error: null, currentPath: path });
    wsSend('directory:list', { path });
  },

  readFile: (path, wsSend) => {
    const activeServerId = useRemoteStore.getState().activeServerId;
    if (!activeServerId) {
      set({ error: '请先连接远程服务器' });
      return;
    }

    set({ isLoading: true, error: null, selectedFile: path });
    wsSend('file:read', { path });
  },

  refresh: (wsSend) => {
    const { currentPath } = get();
    get().listDirectory(currentPath, wsSend);
  },

  goBack: (wsSend) => {
    const { pathHistory, currentPath } = get();
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      set({
        pathHistory: pathHistory.slice(0, -1),
        currentPath: previousPath,
      });
      get().listDirectory(previousPath, wsSend);
    }
  },

  setSelectedFile: (path) => set({ selectedFile: path }),
  setFiles: (files) => set({ files, isLoading: false }),
  setFileContent: (content) => set({ fileContent: content, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}));
