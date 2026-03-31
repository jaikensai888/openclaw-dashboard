'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Download, Loader2, File, Copy, Check } from 'lucide-react';
import { useFileStore } from '@/stores/fileStore';
import { cn } from '@/lib/utils';

interface FilePreviewProps {
  filePath: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function FilePreview({ filePath, onBack, onRefresh }: FilePreviewProps) {
  const { fileContent, isLoading, error, readFile } = useFileStore();
  const [copied, setCopied] = useState(false);

  const fileName = filePath.split('/').pop() || filePath;

  const isLogFile = fileName.endsWith('.log') || fileName.includes('log');

  const handleCopy = async () => {
    if (fileContent) {
      try {
        await navigator.clipboard.writeText(fileContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleDownload = () => {
    if (fileContent) {
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Determine content type for syntax highlighting
  const getContentClass = () => {
    if (fileName.endsWith('.json')) return 'language-json';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'language-typescript';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'language-javascript';
    if (fileName.endsWith('.md')) return 'language-markdown';
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'language-yaml';
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-neutral-700 flex items-center justify-between">
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
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
              title="刷新"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!fileContent}
            className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
            title="复制内容"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            disabled={!fileContent}
            className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
            title="下载"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filename */}
      <div className="px-3 py-2 border-b border-neutral-700">
        <p className="text-sm font-medium text-neutral-200 truncate">{fileName}</p>
        <p className="text-xs text-neutral-500 truncate">{filePath}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <Loader2 className="w-6 h-6 mb-2 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
            <File className="w-12 h-12 mb-3 opacity-50" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        ) : fileContent ? (
          <pre className={cn('p-4 text-xs text-neutral-300 font-mono whitespace-pre-wrap break-all', getContentClass())}>
            {fileContent}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
            <File className="w-12 h-12 mb-3 opacity-50" />
            <span className="text-sm">无内容</span>
          </div>
        )}
      </div>
    </div>
  );
}
