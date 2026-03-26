'use client';

import { useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronLeft, RefreshCw, Loader2, Home } from 'lucide-react';
import { useFileStore, FileInfo } from '@/stores/fileStore';
import { useRemoteStore } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';

interface FileExplorerProps {
  onFileSelect: (file: FileInfo) => void;
}

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const {
    currentPath,
    files,
    isLoading,
    error,
    listDirectory,
    refresh,
    goBack,
  } = useFileStore();

  const { activeServerId, servers } = useRemoteStore();
  const activeServer = servers.find((s) => s.id === activeServerId);
  const isConnected = activeServer?.status === 'connected';

  // Send WebSocket message helper
  const wsSend = (type: string, payload: unknown) => {
    // Import send function dynamically to avoid circular dependencies
    const ws = (window as unknown as { __wsSend?: (type: string, payload: unknown) => void }).__wsSend;
    if (ws) {
      ws(type, payload);
    }
  };

  // Load root directory when connected
  useEffect(() => {
    if (isConnected && currentPath === '/') {
      listDirectory('/', wsSend);
    }
  }, [isConnected]);

  const handleDirectoryClick = (file: FileInfo) => {
    if (file.isDirectory) {
      listDirectory(file.path, wsSend);
    }
  };

  const handleFileClick = (file: FileInfo) => {
    if (!file.isDirectory) {
      onFileSelect(file);
    }
  };

  const handleRefresh = () => {
    refresh(wsSend);
  };

  const handleBack = () => {
    goBack(wsSend);
  };

  const handleBreadcrumbClick = (path: string) => {
    listDirectory(path, wsSend);
  };

  // Parse path into segments for breadcrumb
  const pathSegments = currentPath.split('/').filter(Boolean);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
        <Folder className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">请先连接远程服务器</p>
        <p className="text-xs mt-1 text-neutral-600">连接后可浏览远程文件</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
        <File className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-300 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Path navigation */}
      <div className="p-3 border-b border-neutral-700">
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => handleBreadcrumbClick('/')}
            className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
            title="根目录"
          >
            <Home className="w-4 h-4" />
          </button>
          {pathSegments.map((segment, index) => {
            const segmentPath = '/' + pathSegments.slice(0, index + 1).join('/');
            return (
              <div key={segmentPath} className="flex items-center">
                <ChevronRight className="w-3 h-3 text-neutral-600" />
                <button
                  onClick={() => handleBreadcrumbClick(segmentPath)}
                  className="px-1.5 py-0.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors truncate max-w-[80px]"
                  title={segment}
                >
                  {segment}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            disabled={currentPath === '/'}
            className={cn(
              'p-1.5 rounded transition-colors',
              currentPath === '/'
                ? 'text-neutral-700 cursor-not-allowed'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
            )}
            title="返回上级"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded transition-colors',
              isLoading
                ? 'text-neutral-700 cursor-not-allowed'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
            )}
            title="刷新"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
          <span className="text-xs text-neutral-600 truncate flex-1" title={currentPath}>
            {currentPath}
          </span>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-neutral-600">
            <Folder className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">空目录</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-700">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => (file.isDirectory ? handleDirectoryClick(file) : handleFileClick(file))}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-center gap-3 transition-colors',
                  'hover:bg-neutral-700/50'
                )}
              >
                {file.isDirectory ? (
                  <Folder className="w-4 h-4 text-primary-400 flex-shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-neutral-200">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {!file.isDirectory && (
                      <span className="text-xs text-neutral-600">{formatSize(file.size)}</span>
                    )}
                    <span className="text-xs text-neutral-600">{formatDate(file.mtime)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
