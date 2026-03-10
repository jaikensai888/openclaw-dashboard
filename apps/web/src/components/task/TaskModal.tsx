'use client';

import { X, Loader2, CheckCircle, XCircle, Clock, Copy, FileDown, Check, AlertCircle } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import type { Task, TaskStatus } from '@openclaw-dashboard/shared';
import { useEffect, useRef, useState, useCallback } from 'react';

const statusLabels: Record<TaskStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'text-yellow-500 bg-yellow-500/10',
  running: 'text-blue-500 bg-blue-500/10',
  completed: 'text-green-500 bg-green-500/10',
  failed: 'text-red-500 bg-red-500/10',
  cancelled: 'text-neutral-500 bg-neutral-500/10',
};

export function TaskModal() {
  const { taskModalTaskId, tasks, setTaskModalTaskId, taskOutputs } = useChatStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [exportState, setExportState] = useState<'idle' | 'exported' | 'error'>('idle');

  // Handle escape key globally
  useEffect(() => {
    if (!taskModalTaskId) return;

    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTaskModalTaskId(null);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [taskModalTaskId, setTaskModalTaskId]);

  // Focus management - focus first focusable element when modal opens
  useEffect(() => {
    if (taskModalTaskId && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [taskModalTaskId]);

  if (!taskModalTaskId) return null;

  const task = tasks[taskModalTaskId];
  if (!task) return null;

  const outputs = taskOutputs[taskModalTaskId] || [];

  const handleClose = () => {
    setTaskModalTaskId(null);
  };

  const handleCopyAll = async () => {
    try {
      setCopyState('idle'); // Show loading state
      const allContent = outputs.map((o) => o.content).join('\n\n');
      await navigator.clipboard.writeText(allContent);
      setCopyState('copied');
      // Reset to idle after 2 seconds
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyState('error');
    }
  };

  const handleExport = () => {
    try {
      const allContent = outputs.map((o) => o.content).join('\n\n');
      const blob = new Blob([allContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `task-${task.id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setExportState('exported');
      setTimeout(() => setExportState('idle'), 2000);
    } catch (err) {
      console.error('Failed to export:', err);
      setExportState('error');
    }
  };

  // Calculate duration
  const duration =
    task.startedAt && task.completedAt
      ? Math.round(
          (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000
        )
      : null;

  // Get title with length limit
  const displayTitle = task.title || `${task.type} 任务`;
  const truncatedTitle = displayTitle.length > 50
    ? displayTitle.slice(0, 47) + '...'
    : displayTitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
      role="presentation"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-neutral-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 id="task-modal-title" className="text-lg font-semibold truncate" title={truncatedTitle}>
            {displayTitle.length > 50 && (
              <span className="sr-only">完整标题: {displayTitle}</span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="p-2 min-w-[44px] min-h-[44px] hover:bg-neutral-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status */}
        <div className="px-4 py-3 border-b border-neutral-700 flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm ${statusColors[task.status]}`}
          >
            {task.status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : task.status === 'completed' ? (
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
            ) : task.status === 'failed' ? (
              <XCircle className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{statusLabels[task.status]}</span>
          </span>

          {duration !== null && (
            <span className="text-sm text-neutral-400">耗时 {duration} 秒</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {outputs.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              {task.status === 'running' ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" aria-hidden="true" />
                  <p>任务进行中...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-neutral-500" aria-hidden="true" />
                  <p>暂无输出内容</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {outputs.map((output, index) => {
                const contentId = `output-${task.id.slice(0, 8)}-${index}`;
                return (
                  <div
                    key={output.id || index}
                    className="bg-neutral-700 rounded-lg p-4 min-w-0"
                  >
                    {output.type === 'code' ? (
                      <pre className="text-sm overflow-x-auto">
                        <code className="whitespace-pre-wrap break-words">{output.content}</code>
                      </pre>
                    ) : (
                      <div className="markdown-content">
                        <p className="whitespace-pre-wrap break-words text-sm">{output.content}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-700">
          <button
            onClick={handleCopyAll}
            disabled={outputs.length === 0}
            className="flex items-center gap-2 px-4 py-3 text-sm bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={copyState === 'copied' ? '已复制' : '复制全部内容'}
          >
            {copyState === 'copied' ? (
              <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
            ) : copyState === 'error' ? (
              <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4" aria-hidden="true" />
            )}
            <span className={copyState === 'copied' ? 'text-green-500' : copyState === 'error' ? 'text-red-500' : ''}>
              {copyState === 'copied' ? '已复制' : copyState === 'error' ? '复制失败' : '复制全部'}
            </span>
          </button>
          <button
            onClick={handleExport}
            disabled={outputs.length === 0}
            className="flex items-center gap-2 px-4 py-3 text-sm bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={exportState === 'exported' ? '已导出' : '导出为 Markdown 文件'}
          >
            {exportState === 'exported' ? (
              <Check className="w-4 h-4 text-green-500" aria-hidden="true" />
            ) : exportState === 'error' ? (
              <XCircle className="w-4 h-4 text-red-500" aria-hidden="true" />
            ) : (
              <FileDown className="w-4 h-4" aria-hidden="true" />
            )}
            <span className={exportState === 'exported' ? 'text-green-500' : exportState === 'error' ? 'text-red-500' : ''}>
              {exportState === 'exported' ? '已导出' : exportState === 'error' ? '导出失败' : '导出'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
