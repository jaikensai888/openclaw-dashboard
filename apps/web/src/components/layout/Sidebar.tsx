'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Settings, Trash2, Menu, X, Pin, Pencil, Check, Search, Bot, Users, Clock } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

// 导航项组件
function NavItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
        isActive ? 'bg-primary-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1 text-left text-sm">{label}</span>
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-600 text-neutral-300">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    conversations,
    currentConversationId,
    setCurrentConversation,
    createConversation,
    toggleSidebar,
    currentView,
    setCurrentView,
    searchQuery,
    setSearchQuery,
  } = useChatStore();
  const { switchConversation, createConversation: createConversationWS, renameConversation, togglePinConversation, deleteConversation } = useWebSocket();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleNewChat = () => {
    const id = createConversation();
    createConversationWS(id);
  };

  const handleSelectConversation = (id: string) => {
    // Don't switch if editing
    if (editingId === id) return;

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

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingTitle(currentTitle || '新对话');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSaveRename = (id: string) => {
    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle) {
      renameConversation(id, trimmedTitle);
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePinConversation(id);
  };

  // 过滤会话列表
  const filteredConversations = conversations.filter((c) =>
    !searchQuery || (c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const pinnedConversations = filteredConversations.filter((c) => c.pinned);
  const unpinnedConversations = filteredConversations.filter((c) => !c.pinned);

  // Conversation item component
  const ConversationItem = ({ conv }: { conv: { id: string; title?: string | null; pinned: boolean } }) => {
    const isEditing = editingId === conv.id;

    return (
      <div
        onClick={() => !isEditing && handleSelectConversation(conv.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => !isEditing && e.key === 'Enter' && handleSelectConversation(conv.id)}
        className={cn(
          'group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
          conv.id === currentConversationId && !isEditing
            ? 'bg-neutral-700'
            : 'hover:bg-neutral-700/50'
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, conv.id)}
                className="flex-1 bg-neutral-900 border border-primary-500 rounded px-2 py-1 text-sm focus:outline-none min-w-0"
                autoFocus
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveRename(conv.id); }}
                className="p-1.5 hover:bg-neutral-600 rounded transition-colors"
                aria-label="保存"
              >
                <Check className="w-4 h-4 text-green-500" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCancelRename(); }}
                className="p-1.5 hover:bg-neutral-600 rounded transition-colors"
                aria-label="取消"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
          ) : (
            <>
              {conv.pinned && <Pin className="w-3 h-3 text-primary-500 flex-shrink-0" />}
              <span className="truncate text-sm">{conv.title || '新对话'}</span>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={(e) => handleTogglePin(conv.id, e)}
              className={cn(
                'p-1.5 hover:bg-neutral-600 rounded transition-colors',
                conv.pinned && 'opacity-100'
              )}
              aria-label={conv.pinned ? '取消置顶' : '置顶'}
            >
              <Pin className={cn('w-4 h-4', conv.pinned ? 'text-primary-500' : 'text-neutral-400')} />
            </button>
            <button
              onClick={(e) => handleStartRename(conv.id, conv.title || '', e)}
              className="p-1.5 hover:bg-neutral-600 rounded transition-colors"
              aria-label="重命名"
            >
              <Pencil className="w-4 h-4 text-neutral-400" />
            </button>
            <button
              onClick={(e) => handleDelete(conv.id, e)}
              className="p-1.5 hover:bg-neutral-600 rounded transition-colors"
              aria-label={`删除对话 ${conv.title || '新对话'}`}
            >
              <Trash2 className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        )}
      </div>
    );
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

        {/* Search - 新增 */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                aria-label="清除搜索"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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

        {/* Navigation - 新增 */}
        <div className="px-3 py-2 space-y-1 border-b border-neutral-700">
          <NavItem
            icon={Bot}
            label="Claw"
            isActive={currentView === 'chat'}
            onClick={() => setCurrentView('chat')}
          />
          <NavItem
            icon={Users}
            label="专家"
            isActive={currentView === 'expert'}
            onClick={() => setCurrentView('expert')}
          />
          <NavItem
            icon={Clock}
            label="自动化"
            isActive={currentView === 'automation'}
            onClick={() => setCurrentView('automation')}
            badge="Beta"
          />
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? '没有匹配的会话' : '暂无对话'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Pinned conversations */}
              {pinnedConversations.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs text-neutral-500 font-medium">置顶</div>
                  {pinnedConversations.map((conv) => (
                    <ConversationItem key={conv.id} conv={conv} />
                  ))}
                  {unpinnedConversations.length > 0 && (
                    <div className="my-2 border-t border-neutral-700" />
                  )}
                </>
              )}

              {/* Unpinned conversations */}
              {unpinnedConversations.length > 0 && pinnedConversations.length > 0 && (
                <div className="px-3 py-2 text-xs text-neutral-500 font-medium">对话</div>
              )}
              {unpinnedConversations.map((conv) => (
                <ConversationItem key={conv.id} conv={conv} />
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
