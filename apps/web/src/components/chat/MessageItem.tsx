'use client';

import { User, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import type { Message } from '@openclaw-dashboard/shared';

interface MessageItemProps {
  message: Message;
  onRetry?: (tempId: string) => void;
}

export function MessageItem({ message, onRetry }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-neutral-600' : 'bg-primary-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <span className="text-sm font-medium">AI</span>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 relative ${
          isUser
            ? 'bg-primary-600 rounded-l-xl rounded-tr-xl'
            : 'bg-neutral-800 rounded-r-xl rounded-tl-xl'
        } p-4 ${isFailed ? 'border-l-4 border-red-500' : ''}`}
      >
        <div className="markdown-content">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Pending 指示器 */}
        {isPending && (
          <div className="absolute top-2 right-2">
            <Loader2 className="w-4 h-4 animate-spin text-white/50" />
          </div>
        )}

        {/* Failed 状态 */}
        {isFailed && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{message.error || '发送失败'}</span>
            {message.tempId && onRetry && (
              <button
                onClick={() => onRetry(message.tempId!)}
                className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
