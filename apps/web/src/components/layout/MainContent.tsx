'use client';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { ExpertCenter } from '@/components/expert/ExpertCenter';
import { useChatStore } from '@/stores/chatStore';
import { Sparkles, Clock } from 'lucide-react';

export function MainContent() {
  const { currentConversationId, currentView } = useChatStore();

  // 根据当前视图渲染不同内容
  const renderView = () => {
    switch (currentView) {
      case 'expert':
        return <ExpertCenter />;
      case 'automation':
        return (
          <main id="main-content" className="flex-1 flex flex-col bg-neutral-900" role="main">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-neutral-500 max-w-md px-4">
                <div className="mb-6">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-primary-500 opacity-50" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-semibold mb-3 text-neutral-200">
                  自动化中心
                </h1>
                <p className="text-sm mb-6">
                  管理自动化任务并查看近期运行记录
                </p>
                <div className="inline-block px-2 py-1 rounded bg-neutral-700 text-xs">
                  Beta
                </div>
              </div>
            </div>
          </main>
        );
      case 'chat':
      default:
        if (!currentConversationId) {
          return (
            <main id="main-content" className="flex-1 flex items-center justify-center bg-neutral-900" role="main">
              {/* Skip link target */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-neutral-800 focus:p-2 focus:rounded"
              >
                Skip to main content
              </a>
              <div className="text-center text-neutral-500 max-w-md px-4">
                <div className="mb-6">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary-500 opacity-50" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-semibold mb-3 text-neutral-200">
                  欢迎使用 Openclaw Dashboard
                </h1>
                <p className="text-sm mb-6">
                  点击「新对话」开始与 AI 交流
                </p>
                <div className="flex flex-col gap-2 text-xs text-neutral-600">
                  <p>实时聊天 - 类似 ChatGPT 的聊天体验</p>
                  <p>任务追踪 - 通过内联标记识别任务状态</p>
                  <p>流式响应 - 实时显示 Agent 回复</p>
                </div>
              </div>
            </main>
          );
        }
        return (
          <main id="main-content" className="flex-1 flex flex-col bg-neutral-900" role="main">
            {/* Skip link - visually hidden until focused */}
            <a
              href="#chat-input"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-neutral-800 focus:p-2 focus:rounded"
            >
              Skip to chat input
            </a>
            <ChatPanel />
          </main>
        );
    }
  };

  return renderView();
}
