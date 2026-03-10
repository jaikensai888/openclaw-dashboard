'use client';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatStore } from '@/stores/chatStore';

export function MainContent() {
  const { currentConversationId } = useChatStore();

  if (!currentConversationId) {
    return (
      <main className="flex-1 flex items-center justify-center bg-neutral-900">
        <div className="text-center text-neutral-500">
          <h2 className="text-2xl font-semibold mb-2">欢迎使用 Openclaw Dashboard</h2>
          <p className="text-sm">点击「新对话」开始与 AI 交流</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-neutral-900">
      <ChatPanel />
    </main>
  );
}
