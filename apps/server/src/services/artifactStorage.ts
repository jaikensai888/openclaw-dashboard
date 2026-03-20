/**
 * Artifact Storage Service
 * 管理会话产物的文件存储
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

// 基础存储路径
const CONVERSATIONS_DIR = path.join(process.cwd(), 'data', 'conversations');

// 文件类型映射
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  go: 'go',
  rust: 'rs',
  cpp: 'cpp',
  c: 'c',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'md',
  yaml: 'yaml',
  sql: 'sql',
  shell: 'sh',
  bash: 'sh',
};

const MIME_TYPES: Record<string, string> = {
  js: 'application/javascript',
  ts: 'application/typescript',
  py: 'text/x-python',
  html: 'text/html',
  css: 'text/css',
  json: 'application/json',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

export interface Artifact {
  id: string;
  conversationId: string;
  filename: string;
  type: 'code' | 'image' | 'document' | 'other';
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

interface ArtifactRow {
  id: string;
  conversation_id: string;
  task_id: string | null;
  type: string;
  title: string;
  content: string | null;
  file_path: string | null;
  mime_type: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 确保 conversation 目录存在
 */
export function getConversationDir(conversationId: string): string {
  const dir = path.join(CONVERSATIONS_DIR, conversationId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 根据语言获取文件扩展名
 */
export function getExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'txt';
}

/**
 * 获取 MIME 类型
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'text/plain';
}

/**
 * 保存产物到文件系统并记录到数据库
 */
export function saveArtifact(
  conversationId: string,
  filename: string,
  content: string | Buffer,
  type: 'code' | 'image' | 'document' | 'other' = 'code'
): Artifact {
  const id = `artifact_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const dir = getConversationDir(conversationId);
  const filePath = path.join(dir, filename);

  // 写入文件
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  fs.writeFileSync(filePath, buffer);

  // 获取文件信息
  const stats = fs.statSync(filePath);
  const mimeType = getMimeType(filename);

  // 保存到数据库
  const now = new Date().toISOString();
  run(
    `INSERT INTO artifacts (id, conversation_id, type, title, content, file_path, mime_type, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      conversationId,
      type,
      filename,
      type === 'code' ? (typeof content === 'string' ? content : null) : null,
      filePath,
      mimeType,
      JSON.stringify({ size: stats.size }),
      now,
      now,
    ]
  );

  return {
    id,
    conversationId,
    filename,
    type,
    mimeType,
    size: stats.size,
    path: filePath,
    createdAt: new Date(now),
  };
}

/**
 * 获取会话的所有产物
 */
export function listArtifacts(conversationId: string): Artifact[] {
  const rows = all<ArtifactRow>(
    'SELECT * FROM artifacts WHERE conversation_id = ? ORDER BY created_at DESC',
    [conversationId]
  );

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.title,
    type: row.type as 'code' | 'image' | 'document' | 'other',
    mimeType: row.mime_type || 'text/plain',
    size: row.metadata ? JSON.parse(row.metadata).size || 0 : 0,
    path: row.file_path || '',
    createdAt: new Date(row.created_at),
  }));
}

/**
 * 获取单个产物
 */
export function getArtifact(artifactId: string): (Artifact & { content?: string }) | null {
  const row = get<ArtifactRow>(
    'SELECT * FROM artifacts WHERE id = ?',
    [artifactId]
  );

  if (!row) return null;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.title,
    type: row.type as 'code' | 'image' | 'document' | 'other',
    mimeType: row.mime_type || 'text/plain',
    size: row.metadata ? JSON.parse(row.metadata).size || 0 : 0,
    path: row.file_path || '',
    content: row.content || undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * 读取产物文件内容
 */
export function readArtifactContent(artifactId: string): Buffer | null {
  const artifact = getArtifact(artifactId);
  if (!artifact || !artifact.path) return null;

  try {
    return fs.readFileSync(artifact.path);
  } catch {
    return null;
  }
}

/**
 * 删除产物
 */
export function deleteArtifact(artifactId: string): boolean {
  const artifact = getArtifact(artifactId);
  if (!artifact) return false;

  // 删除文件
  if (artifact.path && fs.existsSync(artifact.path)) {
    fs.unlinkSync(artifact.path);
  }

  // 删除数据库记录
  run('DELETE FROM artifacts WHERE id = ?', [artifactId]);
  return true;
}

/**
 * 删除会话的所有产物
 */
export function deleteConversationArtifacts(conversationId: string): void {
  const dir = path.join(CONVERSATIONS_DIR, conversationId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  run('DELETE FROM artifacts WHERE conversation_id = ?', [conversationId]);
}
