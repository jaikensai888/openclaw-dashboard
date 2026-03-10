'use client';

import { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { useChatStore } from '@/stores/chatStore';

export function ChatPanel() {
  const { currentConversationId, messages, isStreaming, streamingContent } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationMessages = currentConversationId
    ? messages[currentConversationId] || []
    : [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length, streamingContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {conversationMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <p className="text-lg mb-2">开始新的对话</p>
              <p className="text-sm">输入消息与 AI 交流</p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={conversationMessages} />
            {isStreaming && (
              <div className="flex gap-3 py-4">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
                  AI
                </div>
                <div className="flex-1 bg-neutral-800 rounded-lg p-4 markdown-content">
                  <p className="whitespace-pre-wrap streaming-cursor">{streamingContent}</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-700 p-4">
        <InputBar />
      </div>
    </div>
  );
}
