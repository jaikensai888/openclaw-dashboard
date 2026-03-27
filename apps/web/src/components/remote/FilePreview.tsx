'use client';

import { useState } from 'react';
import { File, Download, RefreshCw, ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { useFileStore, FileInfo } from '@/stores/fileStore';
import { useRemoteStore } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
  file: FileInfo;
  onBack: () => void;
}

export function FilePreview({ file, onBack }: FilePreviewProps) {
  const { fileContent, isLoading, error, readFile } = useFileStore();
  const { activeServerId, servers } = useRemoteStore();
  const activeServer = servers.find((s) => s.id === activeServerId);
  const [copied, setCopied] = useState(false);

  const isConnected = activeServer?.status === 'connected';

  // Send WebSocket message helper
  const wsSend = (type: string, payload: unknown) => {
    const ws = (window as unknown as { __wsSend?: (type: string, payload: unknown) => void }).__wsSend;
    if (ws) {
      ws(type, payload);
    }
  };

  const handleRefresh = () => {
    readFile(file.path, wsSend);
  };

  const handleDownload = async () => {
    if (!isConnected || !activeServer) return;

    try {
      // Use HTTP API for download
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';
      const res = await fetch(`${API_BASE}/remote/files/download?path=${encodeURIComponent(file.path)}&serverId=${activeServerId}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleCopy = async () => {
    if (fileContent) {
      await navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLogFile = file.name.endsWith('.log') || file.name.includes('.log.');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      r: 'r',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      vue: 'vue',
      svelte: 'svelte',
    };
    return langMap[ext] || 'text';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-neutral-700">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-neutral-300 hover:text-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-1">
            {isLogFile && (
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
            )}
            <button
              onClick={handleCopy}
              disabled={!fileContent}
              className={cn(
                'p-1.5 rounded transition-colors',
                !fileContent
                  ? 'text-neutral-700 cursor-not-allowed'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              )}
              title="复制内容"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              disabled={!isConnected}
              className={cn(
                'p-1.5 rounded transition-colors',
                !isConnected
                  ? 'text-neutral-700 cursor-not-allowed'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700'
              )}
              title="下载"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <File className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-200 truncate flex-1" title={file.name}>
            {file.name}
          </span>
          <span className="text-xs text-neutral-600">{formatSize(file.size)}</span>
        </div>
        <p className="text-xs text-neutral-600 mt-1 truncate" title={file.path}>
          {file.path}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-neutral-900">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <Loader2 className="w-8 h-8 mb-3 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
            <File className="w-12 h-12 mb-3 opacity-30" />
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={handleRefresh}
              className="mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-300 transition-colors"
            >
              重试
            </button>
          </div>
        ) : fileContent ? (
          <div className="h-full overflow-auto">
            <pre className="p-4 text-xs text-neutral-300 font-mono whitespace-pre-wrap break-all">
              {fileContent}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
            <File className="w-12 h-12 mb-3 opacity-30" />
            <span className="text-sm">点击刷新加载内容</span>
            <button
              onClick={handleRefresh}
              className="mt-3 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs text-neutral-300 transition-colors"
            >
              加载内容
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
