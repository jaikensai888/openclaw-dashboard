'use client';

import { User } from 'lucide-react';
import type { Message } from '@openclaw-dashboard/shared';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

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
        className={`flex-1 ${
          isUser
            ? 'bg-primary-600 rounded-l-xl rounded-tr-xl'
            : 'bg-neutral-800 rounded-r-xl rounded-tl-xl'
        } p-4`}
      >
        <div className="markdown-content">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
