'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import type { Task, TaskStatus, Message } from '@openclaw-dashboard/shared';

interface TaskCardProps {
  taskId: string;
  message: Message;
}

const typeIcons: Record<string, string> = {
  research: '🔬',
  code: '💻',
  file: '📄',
  command: '⚡',
  custom: '📋',
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'text-yellow-500',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-neutral-500',
};

const statusIcons: Record<TaskStatus, typeof Loader2> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
};

export function TaskCard({ taskId, message }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { tasks, setTaskModalTaskId } = useChatStore();

  const task = tasks[taskId];

  if (!task) return null;

  const StatusIcon = statusIcons[task.status];
  const typeIcon = typeIcons[task.type] || '📋';

  const handleClick = () => {
    setTaskModalTaskId(taskId);
  };

  return (
    <div className="bg-neutral-800 rounded-lg overflow-hidden cursor-pointer hover:bg-neutral-700 transition-colors" onClick={handleClick}>
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <div className="text-2xl">{typeIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{task.title || `${task.type} 任务`}</h3>
            <StatusIcon
              className={`w-4 h-4 flex-shrink-0 ${statusColors[task.status]} ${
                task.status === 'running' ? 'animate-spin' : ''
              }`}
            />
          </div>

          {/* Progress bar */}
          {(task.status === 'running' || task.status === 'pending') && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-neutral-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-xs text-neutral-400">{task.progress}%</span>
            </div>
          )}

          {/* Progress message */}
          {task.progressMessage && task.status === 'running' && (
            <p className="text-sm text-neutral-400 mt-1 truncate">{task.progressMessage}</p>
          )}

          {/* Error message */}
          {task.errorMessage && task.status === 'failed' && (
            <p className="text-sm text-red-400 mt-1 truncate">{task.errorMessage}</p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1 hover:bg-neutral-600 rounded"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && message.content && (
        <div className="px-4 pb-4">
          <div className="text-sm text-neutral-300 whitespace-pre-wrap pl-9">
            {message.content}
          </div>
        </div>
      )}
    </div>
  );
}
