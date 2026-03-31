/**
 * 任务 T3-08: 远程服务器 REST API 路由
 * 目标文件: apps/server/src/routes/remote.ts
 *
 * 7 个 REST 端点：CRUD + 连接管理
 */

import { FastifyInstance } from 'fastify';
import { getRemoteConnectionManager } from '../remote';
import { run, get, all } from '../db';

const SERVER_ID_PREFIX = 'server_';

export async function remoteRoutes(fastify: FastifyInstance) {

  // GET /api/v1/remote/servers - 获取所有服务器及状态
  fastify.get('/remote/servers', async () => {
    const servers = all('SELECT * FROM remote_servers ORDER BY created_at DESC') as any[];
    const manager = getRemoteConnectionManager();
    const statuses = manager.getAllServersStatus();

    const result = servers.map(server => {
      const status = statuses.find(s => s.id === server.id);
      return {
        ...server,
        status: status?.status || 'disconnected',
        error: status?.error,
      };
    });

    return { success: true, data: result };
  });

  // POST /api/v1/remote/servers - 添加服务器
  fastify.post('/remote/servers', async (request) => {
    const { name, host, port = 22, username, privateKeyPath, remotePort = 3001 } = request.body as any;

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
    manager.loadServerConfigs(
      all('SELECT * FROM remote_servers') as any[]
    );

    return { success: true, data: { id, name, host, port, username, privateKeyPath, remotePort } };
  });

  // PUT /api/v1/remote/servers/:id - 更新服务器配置
  fastify.put('/remote/servers/:id', async (request) => {
    const { id } = request.params as any;
    const body = request.body as any;

    const server = get('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!server) return { success: false, error: '服务器不存在' };

    const now = new Date().toISOString();
    run(
      `UPDATE remote_servers SET name = ?, host = ?, port = ?, username = ?,
       private_key_path = ?, remote_port = ?, updated_at = ?
       WHERE id = ?`,
      [body.name || (server as any).name, body.host || (server as any).host,
       body.port ?? (server as any).port, body.username || (server as any).username,
       body.privateKeyPath ?? (server as any).private_key_path,
       body.remotePort ?? (server as any).remote_port, now, id]
    );

    // 如果已连接，先断开再重新加载配置
    const manager = getRemoteConnectionManager();
    try { await manager.disconnect(id); } catch {}
    manager.loadServerConfigs(all('SELECT * FROM remote_servers') as any[]);

    return { success: true };
  });

  // DELETE /api/v1/remote/servers/:id - 删除服务器
  fastify.delete('/remote/servers/:id', async (request) => {
    const { id } = request.params as any;

    const manager = getRemoteConnectionManager();
    try { await manager.disconnect(id); } catch {}

    run('DELETE FROM remote_servers WHERE id = ?', [id]);
    manager.loadServerConfigs(all('SELECT * FROM remote_servers') as any[]);

    return { success: true };
  });

  // POST /api/v1/remote/servers/:id/connect - 连接服务器
  fastify.post('/remote/servers/:id/connect', async (request) => {
    const { id } = request.params as any;
    const manager = getRemoteConnectionManager();

    await manager.connect(id);

    const status = manager.getAllServersStatus().find(s => s.id === id);
    return { success: true, data: { id, status: status?.status, localPort: status?.localPort } };
  });

  // POST /api/v1/remote/servers/:id/disconnect - 断开服务器
  fastify.post('/remote/servers/:id/disconnect', async (request) => {
    const { id } = request.params as any;
    const manager = getRemoteConnectionManager();

    await manager.disconnect(id);
    return { success: true };
  });

  // PUT /api/v1/remote/active - 切换活跃服务器
  fastify.put('/remote/active', async (request) => {
    const { serverId } = request.body as any;
    const manager = getRemoteConnectionManager();

    manager.setActiveServer(serverId || null);
    return { success: true, data: { activeServerId: serverId } };
  });
}
