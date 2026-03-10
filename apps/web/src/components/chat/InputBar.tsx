'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';

const MAX_MESSAGE_LENGTH = 10000;

export function InputBar() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentConversationId, isStreaming } = useChatStore();
  const { sendMessage, cancelTask } = useWebSocket();

  const charCount = input.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  const handleSubmit = () => {
    const content = input.trim();
    if (!content || !currentConversationId || isStreaming || isOverLimit) return;

    // Send to server (server will broadcast the message back)
    sendMessage(currentConversationId, content);

    // Clear input
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleCancel = () => {
    if (currentConversationId) {
      // Find the current task for this conversation and cancel it
      // This is a simplified implementation - in real app you'd track the actual task ID
      cancelTask('current');
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Hard truncate at limit to prevent overflow
    if (newValue.length <= MAX_MESSAGE_LENGTH) {
      setInput(newValue);
    } else {
      setInput(newValue.slice(0, MAX_MESSAGE_LENGTH));
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Visually hidden label for accessibility */}
      <label htmlFor="message-input" className="sr-only">
        输入消息
      </label>
      <div className="relative flex items-end bg-neutral-800 rounded-xl border border-neutral-700 focus-within:border-neutral-600 transition-colors">
        <textarea
          ref={textareaRef}
          id="message-input"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1 bg-transparent resize-none px-4 py-3 outline-none text-sm min-h-[48px] max-h-[200px] placeholder-neutral-500"
          rows={1}
          disabled={isStreaming}
          aria-describedby="message-hint"
          aria-invalid={isOverLimit}
        />
        <div className="flex items-center gap-1 m-2">
          {isStreaming ? (
            <>
              <button
                onClick={handleCancel}
                className="p-2 min-w-[44px] min-h-[44px] rounded-lg bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="取消发送"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-2" aria-label="发送中" aria-live="polite">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
              </div>
            </>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming || isOverLimit}
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="发送消息"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div id="message-hint" className="flex items-center justify-between mt-2 px-1">
        <p className="text-xs text-neutral-500">
          Openclaw 可能产生不准确的信息，请核实重要内容
        </p>
        <p className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-neutral-500'}`}>
          {charCount}/{MAX_MESSAGE_LENGTH}
        </p>
      </div>
    </div>
  );
}
