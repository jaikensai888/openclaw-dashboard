'use client';

import { Play, Pause, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Automation } from '@/stores/chatStore';

interface AutomationItemProps {
  automation: Automation;
  onToggleStatus: (id: string, status: 'active' | 'paused') => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
}

export function AutomationItem({ automation, onToggleStatus, onDelete, onRun }: AutomationItemProps) {
  const isActive = automation.status === 'active';
  const isPaused = automation.status === 'paused';

  // Calculate relative time
  const getRelativeTime = (date: Date | string) => {
    const now = new Date();
    const target = new Date(date);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMs < 0) return '已过期';
    if (diffMins < 60) return `${diffMins}分钟后`;
    if (diffHours < 24) return `${diffHours}小时后`;
    if (diffDays === 1) return '明天';
    if (diffDays < 7) return `${diffDays}天后`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周后`;
    return `${Math.floor(diffDays / 30)}个月后`;
  };

  // Format schedule description
  const formatSchedule = (automation: Automation) => {
    if (automation.scheduleDescription) {
      return automation.scheduleDescription;
    }
    // Parse cron expression for simple cases
    return automation.schedule;
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors">
      {/* Status indicator */}
      <div
        className={cn(
          'w-3 h-3 rounded-full flex-shrink-0',
          isActive ? 'bg-green-500' : isPaused ? 'bg-yellow-500' : 'bg-neutral-600'
        )}
        aria-label={isActive ? '运行中' : isPaused ? '已暂停' : '已停止'}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-neutral-200 truncate">
          {automation.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
          <span className="px-1.5 py-0.5 rounded bg-neutral-700">
            Claw
          </span>
          <span>{formatSchedule(automation)}</span>
        </div>
      </div>

      {/* Next run info */}
      {automation.nextRunAt && isActive && (
        <div className="text-xs text-neutral-500 text-right">
          <p className="text-neutral-400">{getRelativeTime(automation.nextRunAt)}</p>
          <p className="text-neutral-600">开始</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Run now */}
        <button
          onClick={() => onRun(automation.id)}
          className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="立即执行"
          title="立即执行"
        >
          <Play className="w-4 h-4" />
        </button>

        {/* Pause/Resume */}
        <button
          onClick={() => onToggleStatus(automation.id, isActive ? 'paused' : 'active')}
          className={cn(
            'p-2 min-w-[44px] min-h-[44px] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
            isActive
              ? 'hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
              : 'hover:bg-green-600/20 text-green-400'
          )}
          aria-label={isActive ? '暂停' : '恢复'}
          title={isActive ? '暂停' : '恢复'}
        >
          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(automation.id)}
          className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-red-600/20 text-neutral-400 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="删除"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
