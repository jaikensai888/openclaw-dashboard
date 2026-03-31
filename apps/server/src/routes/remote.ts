/**
 * Remote Server REST API Routes
 *
 * CRUD + connection management for remote servers.
 */

import { FastifyInstance } from 'fastify';
import { getRemoteConnectionManager } from '../remote/manager.js';
import { run, get, all } from '../db/index.js';

const SERVER_ID_PREFIX = 'server_';

interface RemoteServerRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  private_key_path: string | null;
  remote_port: number;
  created_at: string;
  updated_at: string;
}

function rowToApi(row: RemoteServerRow, status?: string, error?: string) {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    privateKeyPath: row.private_key_path,
    remotePort: row.remote_port,
    status: status || 'disconnected',
    error: error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function remoteRoutes(fastify: FastifyInstance) {

  // GET /api/v1/remote/servers - 获取所有服务器及状态
  fastify.get('/remote/servers', async () => {
    const servers = all<RemoteServerRow>('SELECT * FROM remote_servers ORDER BY created_at DESC');
    const manager = getRemoteConnectionManager();

    let statuses: { serverId: string; tunnelStatus: { status: string }; rpcConnected: boolean }[] = [];
    if (manager) {
      statuses = manager.getAllServersStatus();
    }

    const result = servers.map(server => {
      const status = statuses.find(s => s.serverId === server.id);
      return rowToApi(
        server,
        status ? (status.rpcConnected ? 'connected' : status.tunnelStatus?.status) : 'disconnected'
      );
    });

    return { success: true, data: result };
  });

  // POST /api/v1/remote/servers - 添加服务器
  fastify.post('/remote/servers', async (request) => {
    const { name, host, port = 22, username, privateKeyPath, remotePort = 3001 } = request.body as {
      name?: string;
      host?: string;
      port?: number;
      username?: string;
      privateKeyPath?: string;
      remotePort?: number;
    };

    if (!name || !host || !username) {
      return { success: false, error: 'name, host, username 必填' };
    }

    const id = `${SERVER_ID_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO remote_servers (id, name, host, port, username, private_key_path, remote_port, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, host, port, username, privateKeyPath || null, remotePort, now, now]
    );

    const manager = getRemoteConnectionManager();
    if (manager) {
      manager.loadServerConfigs(
        all<RemoteServerRow>('SELECT * FROM remote_servers').map(r => ({
          id: r.id,
          name: r.name,
          host: r.host,
          port: r.port,
          username: r.username,
          privateKeyPath: r.private_key_path || undefined,
          remotePort: r.remote_port,
        }))
      );
    }

    return {
      success: true,
      data: { id, name, host, port, username, privateKeyPath, remotePort, createdAt: now, updatedAt: now },
    };
  });

  // PUT /api/v1/remote/servers/:id - 更新服务器配置
  fastify.put('/remote/servers/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      host?: string;
      port?: number;
      username?: string;
      privateKeyPath?: string;
      remotePort?: number;
    };

    const server = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!server) return { success: false, error: '服务器不存在' };

    const now = new Date().toISOString();
    run(
      `UPDATE remote_servers SET name = ?, host = ?, port = ?, username = ?,
       private_key_path = ?, remote_port = ?, updated_at = ?
       WHERE id = ?`,
      [
        body.name || server.name,
        body.host || server.host,
        body.port ?? server.port,
        body.username || server.username,
        body.privateKeyPath ?? server.private_key_path,
        body.remotePort ?? server.remote_port,
        now,
        id,
      ]
    );

    // 如果已连接，先断开再重新加载配置
    const manager = getRemoteConnectionManager();
    if (manager) {
      try { await manager.disconnect(id); } catch {}
      manager.loadServerConfigs(
        all<RemoteServerRow>('SELECT * FROM remote_servers').map(r => ({
          id: r.id,
          name: r.name,
          host: r.host,
          port: r.port,
          username: r.username,
          privateKeyPath: r.private_key_path || undefined,
          remotePort: r.remote_port,
        }))
      );
    }

    return { success: true };
  });

  // DELETE /api/v1/remote/servers/:id - 删除服务器
  fastify.delete('/remote/servers/:id', async (request) => {
    const { id } = request.params as { id: string };

    const manager = getRemoteConnectionManager();
    if (manager) {
      try { await manager.disconnect(id); } catch {}
    }

    run('DELETE FROM remote_servers WHERE id = ?', [id]);

    if (manager) {
      manager.loadServerConfigs(
        all<RemoteServerRow>('SELECT * FROM remote_servers').map(r => ({
          id: r.id,
          name: r.name,
          host: r.host,
          port: r.port,
          username: r.username,
          privateKeyPath: r.private_key_path || undefined,
          remotePort: r.remote_port,
        }))
      );
    }

    return { success: true };
  });

  // POST /api/v1/remote/servers/:id/connect - 连接服务器
  fastify.post('/remote/servers/:id/connect', async (request) => {
    const { id } = request.params as { id: string };
    const manager = getRemoteConnectionManager();

    if (!manager) {
      return { success: false, error: '远程连接管理器未初始化' };
    }

    await manager.connect(id);

    const status = manager.getAllServersStatus().find(s => s.serverId === id);
    return {
      success: true,
      data: {
        id,
        status: status?.rpcConnected ? 'connected' : status?.tunnelStatus?.status || 'connecting',
      },
    };
  });

  // POST /api/v1/remote/servers/:id/disconnect - 断开服务器
  fastify.post('/remote/servers/:id/disconnect', async (request) => {
    const { id } = request.params as { id: string };
    const manager = getRemoteConnectionManager();

    if (!manager) {
      return { success: false, error: '远程连接管理器未初始化' };
    }

    await manager.disconnect(id);
    return { success: true };
  });

  // PUT /api/v1/remote/active - 切换活跃服务器
  fastify.put('/remote/active', async (request) => {
    const { serverId } = request.body as { serverId?: string };
    const manager = getRemoteConnectionManager();

    if (!manager) {
      return { success: false, error: '远程连接管理器未初始化' };
    }

    manager.setActiveServer(serverId || null);
    return { success: true, data: { activeServerId: serverId || null } };
  });
}
