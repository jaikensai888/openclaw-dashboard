'use client';

import { MessageItem } from './MessageItem';
import { TaskCard } from './TaskCard';
import type { Message } from '@openclaw-dashboard/shared';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {messages.map((message) => {
        // Show task card for task messages
        if (message.messageType === 'task_start' && message.taskId) {
          return (
            <TaskCard
              key={message.id}
              taskId={message.taskId}
              message={message}
            />
          );
        }

        // Regular message
        return <MessageItem key={message.id} message={message} />;
      })}
    </div>
  );
}
