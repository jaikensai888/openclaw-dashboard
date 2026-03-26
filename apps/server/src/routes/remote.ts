// apps/server/src/routes/remote.ts
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';
import { getRemoteConnectionManager, type RemoteServerConfig } from '../remote/index.js';

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

function rowToConfig(row: RemoteServerRow): RemoteServerConfig {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    privateKeyPath: row.private_key_path || undefined,
    remotePort: row.remote_port,
  };
}

export async function remoteRoutes(fastify: FastifyInstance) {
  const manager = getRemoteConnectionManager();
  if (!manager) {
    console.warn('RemoteConnectionManager not initialized');
    return;
  }

  // GET /api/v1/remote/servers - 获取所有服务器状态
  fastify.get('/remote/servers', async (request, reply) => {
    const rows = all<RemoteServerRow>('SELECT * FROM remote_servers ORDER BY created_at');
    const configs = rows.map(rowToConfig);
    const statuses = manager.getAllServersStatus();

    // 合并配置和状态
    const servers = configs.map((config) => {
      const status = statuses.find((s) => s.serverId === config.id);
      return {
        ...config,
        status: status || {
          serverId: config.id,
          tunnelStatus: { serverId: config.id, status: 'disconnected' as const },
          rpcConnected: false,
          gatewayConnected: false,
        },
      };
    });

    return { success: true, data: servers };
  });

  // GET /api/v1/remote/servers/:id - 获取单个服务器
  fastify.get('/remote/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Server not found' });
    }

    return { success: true, data: rowToConfig(row) };
  });

  // POST /api/v1/remote/servers - 添加服务器
  fastify.post('/remote/servers', async (request, reply) => {
    const body = request.body as {
      name: string;
      host: string;
      port?: number;
      username: string;
      privateKeyPath?: string;
      remotePort?: number;
    };

    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO remote_servers (id, name, host, port, username, private_key_path, remote_port, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.name, body.host, body.port ?? 22, body.username, body.privateKeyPath ?? null, body.remotePort ?? 3001, now, now]
    );

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    return { success: true, data: rowToConfig(row!) };
  });

  // PUT /api/v1/remote/servers/:id - 更新服务器
  fastify.put('/remote/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      host: string;
      port: number;
      username: string;
      privateKeyPath: string;
      remotePort: number;
    }>;
    const now = new Date().toISOString();

    const existing = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Server not found' });
    }

    run(
      `UPDATE remote_servers SET name = ?, host = ?, port = ?, username = ?, private_key_path = ?, remote_port = ?, updated_at = ? WHERE id = ?`,
      [
        body.name ?? existing.name,
        body.host ?? existing.host,
        body.port ?? existing.port,
        body.username ?? existing.username,
        body.privateKeyPath ?? existing.private_key_path,
        body.remotePort ?? existing.remote_port,
        now,
        id,
      ]
    );

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    return { success: true, data: rowToConfig(row!) };
  });

  // DELETE /api/v1/remote/servers/:id - 删除服务器
  fastify.delete('/remote/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 先断开连接
    await manager.disconnect(id);

    run('DELETE FROM remote_servers WHERE id = ?', [id]);
    return { success: true };
  });

  // POST /api/v1/remote/servers/:id/connect - 连接服务器
  fastify.post('/remote/servers/:id/connect', async (request, reply) => {
    const { id } = request.params as { id: string };

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!row) {
      return reply.status(404).send({ success: false, error: 'Server not found' });
    }

    manager.loadServerConfigs([rowToConfig(row)]);

    try {
      await manager.connect(id);
      return { success: true };
    } catch (error) {
      return reply.status(500).send({ success: false, error: String(error) });
    }
  });

  // POST /api/v1/remote/servers/:id/disconnect - 断开服务器
  fastify.post('/remote/servers/:id/disconnect', async (request, reply) => {
    const { id } = request.params as { id: string };
    await manager.disconnect(id);
    return { success: true };
  });

  // PUT /api/v1/remote/active - 切换当前服务器
  fastify.put('/remote/active', async (request, reply) => {
    const { serverId } = request.body as { serverId: string | null };
    manager.setActiveServer(serverId);
    return { success: true, activeServerId: serverId };
  });
}
