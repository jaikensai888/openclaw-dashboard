'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Server,
  Plus,
  Plug,
  PlugZap,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useRemoteStore, RemoteServer } from '@/stores/remoteStore';
import { cn } from '@/lib/utils';
import { ServerForm } from './ServerForm';

// Status indicator component
function StatusIndicator({ status }: { status: RemoteServer['status'] }) {
  const statusConfig = {
    connected: { color: 'bg-green-500', label: '已连接' },
    connecting: { color: 'bg-amber-500 animate-pulse', label: '连接中' },
    disconnected: { color: 'bg-neutral-500', label: '未连接' },
    error: { color: 'bg-red-500', label: '连接失败' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <div className={cn('w-2 h-2 rounded-full', config.color)} />
      <span className="text-xs text-neutral-400">{config.label}</span>
    </div>
  );
}

// Server item component
function ServerItem({
  server,
  isActive,
  onSelect,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
}: {
  server: RemoteServer;
  isActive: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const handleAction = (action: () => void, e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn(
        'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-primary-600/20 border border-primary-500/30' : 'hover:bg-neutral-700/50'
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Server className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm">{server.name}</div>
          <div className="text-xs text-neutral-500 truncate">
            {server.host}:{server.port}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {showActions && (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {server.status === 'connected' ? (
              <button
                onClick={(e) => handleAction(onDisconnect, e)}
                className="p-1 hover:bg-neutral-600 rounded transition-colors"
                title="断开连接"
              >
                <PlugZap className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            ) : server.status === 'connecting' ? (
              <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
            ) : (
              <button
                onClick={(e) => handleAction(onConnect, e)}
                className="p-1 hover:bg-neutral-600 rounded transition-colors"
                title="连接"
              >
                <Plug className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}
            <button
              onClick={(e) => handleAction(onEdit, e)}
              className="p-1 hover:bg-neutral-600 rounded transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            <button
              onClick={(e) => handleAction(onDelete, e)}
              className="p-1 hover:bg-neutral-600 rounded transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        )}
        {!showActions && <StatusIndicator status={server.status} />}
      </div>
    </div>
  );
}

export function ServerManager() {
  const {
    servers,
    activeServerId,
    managerExpanded,
    isLoading,
    loadServers,
    connectServer,
    disconnectServer,
    switchServer,
    removeServer,
    toggleManager,
  } = useRemoteStore();

  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<RemoteServer | null>(null);

  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleAddServer = () => {
    setEditingServer(null);
    setShowForm(true);
  };

  const handleEditServer = (server: RemoteServer) => {
    setEditingServer(server);
    setShowForm(true);
  };

  const handleDeleteServer = async (server: RemoteServer) => {
    if (confirm(`确定要删除服务器 "${server.name}" 吗？`)) {
      await removeServer(server.id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingServer(null);
  };

  return (
    <>
      <div className="border-t border-neutral-700">
        {/* Header */}
        <button
          onClick={toggleManager}
          className="w-full flex items-center justify-between p-3 hover:bg-neutral-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-medium">远程服务器</span>
            {servers.filter((s) => s.status === 'connected').length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                {servers.filter((s) => s.status === 'connected').length}
              </span>
            )}
          </div>
          {managerExpanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {/* Server list */}
        {managerExpanded && (
          <div className="px-2 pb-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              </div>
            ) : servers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-neutral-500">暂无服务器配置</p>
              </div>
            ) : (
              servers.map((server) => (
                <ServerItem
                  key={server.id}
                  server={server}
                  isActive={activeServerId === server.id}
                  onSelect={() => switchServer(server.id)}
                  onConnect={() => connectServer(server.id)}
                  onDisconnect={() => disconnectServer(server.id)}
                  onEdit={() => handleEditServer(server)}
                  onDelete={() => handleDeleteServer(server)}
                />
              ))
            )}

            {/* Add server button */}
            <button
              onClick={handleAddServer}
              className="w-full flex items-center justify-center gap-1.5 p-2 mt-2 text-sm text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700/50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>添加服务器</span>
            </button>
          </div>
        )}
      </div>

      {/* Server form modal */}
      {showForm && (
        <ServerForm
          server={editingServer}
          onClose={handleCloseForm}
        />
      )}
    </>
  );
}
