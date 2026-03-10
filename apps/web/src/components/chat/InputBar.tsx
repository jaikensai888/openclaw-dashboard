'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export function InputBar() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentConversationId, isStreaming } = useChatStore();
  const { sendMessage } = useWebSocket();

  const handleSubmit = () => {
    const content = input.trim();
    if (!content || !currentConversationId || isStreaming) return;

    // Send to server (server will broadcast the message back)
    sendMessage(currentConversationId, content);

    // Clear input
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative flex items-end bg-neutral-800 rounded-xl border border-neutral-700 focus-within:border-neutral-600">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          className="flex-1 bg-transparent resize-none px-4 py-3 outline-none text-sm min-h-[48px] max-h-[200px] placeholder-neutral-500"
          rows={1}
          disabled={isStreaming}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          className="m-2 p-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
      <p className="text-xs text-neutral-500 mt-2 text-center">
        Openclaw 可能产生不准确的信息，请核实重要内容
      </p>
    </div>
  );
}
