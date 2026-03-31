'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Plug, Unplug, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useRemoteStore, type RemoteServer } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';
import { ServerForm } from './ServerForm';

export function ServerManager() {
  const {
    servers,
    activeServerId,
    managerExpanded,
    toggleManager,
    connectServer,
    disconnectServer,
    removeServer,
    switchServer,
  } = useRemoteStore();

  const [editingServer, setEditingServer] = useState<RemoteServer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const getStatusColor = (status: RemoteServer['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-neutral-500';
    }
  };

  const getStatusIcon = (status: RemoteServer['status']) => {
    if (status === 'connecting') {
      return <Loader2 className="w-4 h-4 animate-spin" />;
    }
    return null;
  };

  const connectedCount = servers.filter((s) => s.status === 'connected').length;
  const activeServer = servers.find((s) => s.id === activeServerId);

  if (!managerExpanded) {
    return (
      <div className="p-3 border-t border-neutral-700">
        <button
          onClick={toggleManager}
          className="w-full flex items-center justify-between text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ChevronDown className="w-4 h-4" />
            <span>服务器</span>
          </span>
          {connectedCount > 0 && (
            <span className="text-xs text-green-400">
              {connectedCount} 已连接
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-neutral-700">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <button
          onClick={toggleManager}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          <span>服务器</span>
        </button>
        <button
          onClick={() => setShowAddForm(true)}
          className="p-1.5 hover:bg-neutral-700 rounded transition-colors"
          title="添加服务器"
        >
          <Plus className="w-4 h-4 text-neutral-400" />
        </button>
      </div>

      {/* Server List */}
      <div className="px-2 pb-2 space-y-1 max-h-60 overflow-y-auto">
        {/* Local server (always available) */}
        <div
          onClick={() => switchServer(null)}
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
            activeServerId === null ? 'bg-neutral-700' : 'hover:bg-neutral-700/50'
          )}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="flex-1 text-sm text-neutral-200">本地开发</span>
          {activeServerId === null && (
            <span className="text-xs text-primary-400">当前</span>
          )}
        </div>

        {/* Remote servers */}
        {servers.map((server) => (
          <div
            key={server.id}
            className={cn(
              'p-2 rounded-lg transition-colors',
              activeServerId === server.id ? 'bg-neutral-700' : 'hover:bg-neutral-700/50'
            )}
          >
            <div
              onClick={() => server.status === 'connected' && switchServer(server.id)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                server.status !== 'connected' && 'opacity-60'
              )}
            >
              <div className={cn('w-2 h-2 rounded-full', getStatusColor(server.status))} />
              <span className="flex-1 text-sm text-neutral-200 truncate">{server.name}</span>
              {getStatusIcon(server.status)}
              {activeServerId === server.id && (
                <span className="text-xs text-primary-400">当前</span>
              )}
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {server.host}:{server.port}
              </span>
              <div className="flex items-center gap-0.5">
                {server.status === 'connected' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      disconnectServer(server.id);
                    }}
                    className="p-1 hover:bg-neutral-600 rounded transition-colors"
                    title="断开连接"
                  >
                    <Unplug className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                ) : server.status === 'disconnected' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      connectServer(server.id);
                    }}
                    className="p-1 hover:bg-neutral-600 rounded transition-colors"
                    title="连接"
                  >
                    <Plug className="w-3.5 h-3.5 text-neutral-400" />
                  </button>
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingServer(server);
                  }}
                  className="p-1 hover:bg-neutral-600 rounded transition-colors"
                  title="编辑"
                >
                  <Pencil className="w-3.5 h-3.5 text-neutral-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除服务器 "${server.name}" 吗？`)) {
                      removeServer(server.id);
                    }
                  }}
                  className="p-1 hover:bg-neutral-600 rounded transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5 text-neutral-400 hover:text-red-400" />
                </button>
              </div>
            </div>

            {server.error && (
              <div className="mt-1 text-xs text-red-400 truncate" title={server.error}>
                {server.error}
              </div>
            )}
          </div>
        ))}

        {servers.length === 0 && (
          <div className="py-4 text-center text-sm text-neutral-500">
            <p>暂无远程服务器</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-primary-400 hover:text-primary-300"
            >
              + 添加服务器
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingServer) && (
        <ServerForm
          server={editingServer}
          onClose={() => {
            setShowAddForm(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
}
