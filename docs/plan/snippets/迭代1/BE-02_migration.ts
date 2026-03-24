/**
 * BE-02: 数据库迁移
 *
 * 添加 Migration 8 创建 rules 表
 * 文件：apps/server/src/db/index.ts
 */

// 在现有迁移数组中添加 Migration 8
const migrations = [
  // ... 现有迁移 1-7 ...

  // Migration 8: 创建 rules 表
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template TEXT NOT NULL,
        variables TEXT,
        is_enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(is_enabled);
      CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);
    `,
  },
];

// runMigrations 函数会自动执行 version > currentVersion 的迁移
