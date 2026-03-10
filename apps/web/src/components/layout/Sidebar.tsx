'use client';

import { MessageSquare, Plus, Settings, Trash2, Menu, X } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { sidebarOpen, conversations, currentConversationId, setCurrentConversation, createConversation, deleteConversation, toggleSidebar } = useChatStore();
  const { switchConversation, createConversation: createConversationWS } = useWebSocket();

  const handleNewChat = () => {
    const id = createConversation();
    createConversationWS(id);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id);
    switchConversation(id);
    // Close sidebar on mobile after selecting conversation
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  // Mobile: Show hamburger menu when sidebar is closed
  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-40 p-3 bg-neutral-800 rounded-lg md:hidden hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile overlay - closes sidebar when clicking outside */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      <aside className="fixed md:relative inset-y-0 left-0 w-72 md:w-64 bg-neutral-800 flex flex-col border-r border-neutral-700 z-40 md:z-auto h-full">
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Openclaw</h1>
          <div className="flex items-center gap-1">
            <button
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="设置"
            >
              <Settings className="w-4 h-4 text-neutral-400" />
            </button>
            <button
              onClick={toggleSidebar}
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-neutral-700 transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="关闭菜单"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无对话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectConversation(conv.id)}
                  className={cn(
                    'group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
                    conv.id === currentConversationId
                      ? 'bg-neutral-700'
                      : 'hover:bg-neutral-700/50'
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span className="truncate text-sm">{conv.title || '新对话'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 min-w-[44px] min-h-[44px] hover:bg-neutral-600 rounded transition-all focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label={`删除对话 ${conv.title || '新对话'}`}
                  >
                    <Trash2 className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
            <span>已连接</span>
          </div>
        </div>
      </aside>
    </>
  );
}
