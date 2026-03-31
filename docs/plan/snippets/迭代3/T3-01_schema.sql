/**
 * 任务 T3-01: 数据库变更
 * 目标文件: apps/server/src/db/schema.sql, apps/server/src/db/index.ts
 *
 * 新增 remote_servers 表，conversations 表添加 server_id 列
 */

-- ==================== schema.sql 新增 ====================

CREATE TABLE IF NOT EXISTS remote_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  private_key_path TEXT,
  remote_port INTEGER DEFAULT 3001,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- conversations 表新增列（在迁移中通过 ALTER TABLE 添加）
-- ALTER TABLE conversations ADD COLUMN server_id TEXT REFERENCES remote_servers(id);

-- ==================== index.ts 迁移代码 ====================

// Migration 9: 添加 remote_servers 表和 conversations.server_id
{
  version: 9,
  up: () => {
    run(`
      CREATE TABLE IF NOT EXISTS remote_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        private_key_path TEXT,
        remote_port INTEGER DEFAULT 3001,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查 server_id 列是否已存在
    const columns = all("PRAGMA table_info(conversations)") as Array<{ name: string }>;
    const hasServerId = columns.some(col => col.name === 'server_id');
    if (!hasServerId) {
      run('ALTER TABLE conversations ADD COLUMN server_id TEXT');
    }

    console.log('[DB] Migration 9: Created remote_servers table, added server_id to conversations');
  }
}
