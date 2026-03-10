'use client';

import { useState } from 'react';
import { MessageSquare, Plus, Settings, Trash2 } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { sidebarOpen, conversations, currentConversationId, setCurrentConversation, createConversation, deleteConversation } = useChatStore();
  const { switchConversation, createConversation: createConversationWS } = useWebSocket();

  const handleNewChat = () => {
    const id = createConversation();
    createConversationWS(id);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id);
    switchConversation(id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 bg-neutral-800 flex flex-col border-r border-neutral-700">
      {/* Header */}
      <div className="p-4 border-b border-neutral-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Openclaw</h1>
          <Settings className="w-4 h-4 text-neutral-400 cursor-pointer hover:text-white transition-colors" />
        </div>
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>新对话</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
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
                className={cn(
                  'group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
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
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-600 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-neutral-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-700">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>已连接</span>
        </div>
      </div>
    </aside>
  );
}
