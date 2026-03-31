'use client';

import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronLeft, RefreshCw, Loader2, Home } from 'lucide-react';
import { useFileStore, type FileInfo } from '@/stores/fileStore';
import { useRemoteStore } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  wsSend: (type: string, payload: unknown) => void;
}

export function FileExplorer({ onFileSelect, wsSend }: FileExplorerProps) {
  const {
    currentPath,
    files,
    isLoading,
    error,
    listDirectory,
    goBack,
    refresh,
    clearError,
  } = useFileStore();

  const { activeServerId, servers } = useRemoteStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleDirectoryClick = (file: FileInfo) => {
    if (file.isDirectory) {
      listDirectory(file.path, wsSend);
    } else {
      onFileSelect(file.path);
    }
  };

  const handleGoBack = () => {
    goBack(wsSend);
  };

  const handleRefresh = () => {
    refresh(wsSend);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!activeServerId || !activeServer || activeServer.status !== 'connected') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
        <Folder className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">请先连接远程服务器</p>
        <p className="text-xs mt-1 text-neutral-600">在侧边栏底部管理服务器连接</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Path Navigation */}
      <div className="p-2 border-b border-neutral-700 flex items-center gap-2">
        <button
          onClick={handleGoBack}
          disabled={currentPath === '/'}
          className={cn(
            'p-1.5 rounded transition-colors',
            currentPath === '/'
              ? 'text-neutral-600 cursor-not-allowed'
              : 'hover:bg-neutral-700 text-neutral-400'
          )}
          title="返回上级"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => listDirectory('/', wsSend)}
          className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 transition-colors"
          title="根目录"
        >
          <Home className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-1 text-sm text-neutral-400 overflow-x-auto">
          <span className="text-neutral-500">📁</span>
          <span className="truncate">{currentPath}</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 transition-colors"
          title="刷新"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border-b border-red-900/50 flex items-center justify-between">
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-500">
            <Folder className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">空目录</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-700">
            {files
              .sort((a, b) => {
                // Directories first, then files
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              })
              .map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleDirectoryClick(file)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-700/50 transition-colors text-left',
                    file.isDirectory && 'text-neutral-300',
                    !file.isDirectory && 'text-neutral-400'
                  )}
                >
                  {file.isDirectory ? (
                    <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.name}</p>
                    <p className="text-xs text-neutral-600">
                      {!file.isDirectory && formatFileSize(file.size)} {formatDate(file.mtime)}
                    </p>
                  </div>
                  {file.isDirectory && (
                    <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
