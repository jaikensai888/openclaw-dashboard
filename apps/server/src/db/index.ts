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
