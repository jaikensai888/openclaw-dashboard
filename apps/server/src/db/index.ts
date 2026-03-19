import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DbConfig {
  path: string;
}

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let dbPath: string | null = null;

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export async function initDatabase(config: DbConfig): Promise<SqlJsDatabase> {
  // Ensure data directory exists
  const dbDir = path.dirname(config.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize SQL.js
  SQL = await initSqlJs();
  dbPath = config.path;

  // Load existing database or create new one
  if (fs.existsSync(config.path)) {
    const buffer = fs.readFileSync(config.path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.run(schema);

  // Run migrations (for existing databases)
  runMigrations(db);

  // Seed default data
  seedDefaultExperts();
  seedDefaultCategories();

  // Save initial state
  saveDatabase();

  return db;
}

export function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Run database migrations for existing databases
 */
function runMigrations(database: SqlJsDatabase): void {
  // Migration 1: Add pinned column to conversations if missing
  try {
    const columns = database.exec("PRAGMA table_info(conversations)");
    const columnNames = columns[0]?.values?.map((v) => v[1] as string) || [];

    if (!columnNames.includes('pinned')) {
      console.log('[DB] Migration: Adding pinned column to conversations');
      database.run("ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0");
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 2: Add expert_id column to conversations if missing
  try {
    const columns = database.exec("PRAGMA table_info(conversations)");
    const columnNames = columns[0]?.values?.map((v) => v[1] as string) || [];

    if (!columnNames.includes('expert_id')) {
      console.log('[DB] Migration: Adding expert_id column to conversations');
      database.run("ALTER TABLE conversations ADD COLUMN expert_id TEXT");
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 3: Create experts table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS experts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_experts_category ON experts(category)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 4: Create automations table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        agent_id TEXT NOT NULL,
        schedule TEXT NOT NULL,
        schedule_description TEXT,
        status TEXT DEFAULT 'active',
        last_run_at DATETIME,
        next_run_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 5: Create artifacts table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        file_path TEXT,
        mime_type TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 6: Create categories table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order)`);
    console.log('[DB] Migration: categories table created');
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 7: Make experts.category nullable
  try {
    const testTable = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='experts'");
    const createSql = testTable[0]?.values?.[0]?.[0] as string || '';

    // Only migrate if category is NOT NULL
    if (createSql.includes('category TEXT NOT NULL')) {
      console.log('[DB] Migration: Making experts.category nullable');

      // Create new table with nullable category
      database.run(`
        CREATE TABLE experts_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          avatar TEXT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          system_prompt TEXT NOT NULL,
          color TEXT,
          icon TEXT,
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Copy data
      database.run(`INSERT INTO experts_new SELECT * FROM experts`);

      // Drop old table and rename
      database.run('DROP TABLE experts');
      database.run('ALTER TABLE experts_new RENAME TO experts');
      database.run('CREATE INDEX IF NOT EXISTS idx_experts_category ON experts(category)');
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

// Helper functions for common operations

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export function run(sql: string, params: (string | number | null | Uint8Array)[] = []): RunResult {
  const database = getDatabase();
  database.run(sql, params);
  saveDatabase();
  return {
    lastInsertRowId: (database as unknown as { lastInsertRowId: number }).lastInsertRowId ?? 0,
    changes: (database as unknown as { rowsAffected: number }).rowsAffected ?? 0,
  };
}

export function get<T = unknown>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as T;
  }

  stmt.free();
  return undefined;
}

export function all<T = unknown>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }

  stmt.free();
  return results;
}

/**
 * Seed default experts if none exist
 */
export function seedDefaultExperts(): void {
  const count = get<{ count: number }>('SELECT COUNT(*) as count FROM experts');
  if (count && count.count > 0) {
    return; // Already seeded
  }

  console.log('[DB] Seeding default experts...');
  const now = new Date().toISOString();

  const defaultExperts = [
    {
      id: 'expert_claw_default',
      name: 'Claw',
      avatar: null,
      title: '智能助手',
      description: '通用智能助手，可以处理各种日常任务和问题',
      category: '通用',
      system_prompt: '你是 Claw，一个友好、专业的智能助手。你乐于助人，回答准确，并且始终保持积极的态度。',
      color: '#0ea5e9',
      icon: 'bot',
      is_default: 1,
    },
    {
      id: 'expert_kai_content',
      name: 'Kai',
      avatar: null,
      title: '内容创作专家',
      description: '专注于内容创作，包括文案、文章、创意写作等',
      category: '内容',
      system_prompt: '你是 Kai，一位资深的内容创作专家。你擅长各种类型的文案创作，从商业文案到创意写作，都能精准把握用户需求，产出高质量内容。',
      color: '#22c55e',
      icon: 'pen-tool',
      is_default: 0,
    },
    {
      id: 'expert_phoebe_data',
      name: 'Phoebe',
      avatar: null,
      title: '数据分析专家',
      description: '专注于数据分析和可视化，帮助理解复杂数据',
      category: '数据',
      system_prompt: '你是 Phoebe，一位专业的数据分析专家。你擅长数据清洗、统计分析和数据可视化，能够将复杂的数据转化为清晰的洞察和建议。',
      color: '#f59e0b',
      icon: 'bar-chart-2',
      is_default: 0,
    },
  ];

  for (const expert of defaultExperts) {
    run(
      `INSERT INTO experts (id, name, avatar, title, description, category, system_prompt, color, icon, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expert.id,
        expert.name,
        expert.avatar,
        expert.title,
        expert.description,
        expert.category,
        expert.system_prompt,
        expert.color,
        expert.icon,
        expert.is_default,
        now,
        now,
      ]
    );
  }

  console.log('[DB] Default experts seeded');
}

/**
 * Seed default categories if none exist
 */
export function seedDefaultCategories(): void {
  const count = get<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (count && count.count > 0) {
    return; // Already seeded
  }

  console.log('[DB] Seeding default categories...');
  const now = new Date().toISOString();

  // Get unique categories from experts
  const expertCategories = all<{ category: string; count: number }>(
    'SELECT category, COUNT(*) as count FROM experts WHERE category IS NOT NULL GROUP BY category'
  );

  // Create categories from existing expert categories
  expertCategories.forEach((row, index) => {
    run(
      `INSERT INTO categories (id, name, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`cat_${index}`, row.category, null, index, now, now]
    );
  });

  console.log('[DB] Default categories seeded');
}
