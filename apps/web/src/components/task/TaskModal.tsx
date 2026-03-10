'use client';

import { X, Loader2, CheckCircle, XCircle, Clock, Copy, FileDown } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import type { Task, TaskStatus } from '@openclaw-dashboard/shared';

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

  if (!taskModalTaskId) return null;

  const task = tasks[taskModalTaskId];
  if (!task) return null;

  const outputs = taskOutputs[taskModalTaskId] || [];

  const handleClose = () => {
    setTaskModalTaskId(null);
  };

  const handleCopyAll = () => {
    const allContent = outputs.map((o) => o.content).join('\n\n');
    navigator.clipboard.writeText(allContent);
  };

  const handleExport = () => {
    const allContent = outputs.map((o) => o.content).join('\n\n');
    const blob = new Blob([allContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${task.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate duration
  const duration =
    task.startedAt && task.completedAt
      ? Math.round(
          (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-neutral-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold">{task.title || `${task.type} 任务`}</h2>
          <button onClick={handleClose} className="p-1 hover:bg-neutral-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status */}
        <div className="px-4 py-3 border-b border-neutral-700 flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm ${statusColors[task.status]}`}
          >
            {task.status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : task.status === 'completed' ? (
              <CheckCircle className="w-4 h-4" />
            ) : task.status === 'failed' ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            {statusLabels[task.status]}
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
                <p>任务进行中...</p>
              ) : (
                <p>暂无输出内容</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {outputs.map((output, index) => (
                <div key={output.id || index} className="bg-neutral-700 rounded-lg p-4">
                  {output.type === 'code' ? (
                    <pre className="text-sm overflow-x-auto">
                      <code>{output.content}</code>
                    </pre>
                  ) : (
                    <div className="markdown-content">
                      <p className="whitespace-pre-wrap text-sm">{output.content}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-700">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4" />
            复制全部
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors"
          >
            <FileDown className="w-4 h-4" />
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
