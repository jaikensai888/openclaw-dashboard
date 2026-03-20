/**
 * Artifacts API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';
import {
  getArtifact as getStoredArtifact,
  readArtifactContent,
  listArtifacts as listStoredArtifacts,
  deleteArtifact as deleteStoredArtifact,
} from '../services/artifactStorage.js';

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

function rowToArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    content: row.content,
    filePath: row.file_path,
    mimeType: row.mime_type,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function artifactRoutes(fastify: FastifyInstance) {
  // List artifacts (optionally filtered by conversation)
  fastify.get<{
    Querystring: { conversationId?: string; taskId?: string };
  }>('/artifacts', async (request, reply) => {
    const { conversationId, taskId } = request.query;

    let sql = 'SELECT * FROM artifacts WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (conversationId) {
      sql += ' AND conversation_id = ?';
      params.push(conversationId);
    }
    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const rows = all<ArtifactRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToArtifact),
    };
  });

  // Get single artifact
  fastify.get<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    return { success: true, data: rowToArtifact(row) };
  });

  // Create artifact
  fastify.post<{
    Body: {
      conversationId: string;
      taskId?: string;
      type: string;
      title: string;
      content?: string;
      filePath?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    };
  }>('/artifacts', async (request, reply) => {
    const { conversationId, taskId, type, title, content, filePath, mimeType, metadata } = request.body;
    const id = `artifact_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO artifacts (id, conversation_id, task_id, type, title, content, file_path, mime_type, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        conversationId,
        taskId || null,
        type,
        title,
        content || null,
        filePath || null,
        mimeType || null,
        metadata ? JSON.stringify(metadata) : null,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        conversationId,
        taskId,
        type,
        title,
        content,
        filePath,
        mimeType,
        metadata,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update artifact
  fastify.put<{
    Params: { id: string };
    Body: {
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };
  }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, content, metadata } = request.body;

    const existing = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title : existing.title;
    const newContent = content !== undefined ? content : existing.content;
    const newMetadata = metadata !== undefined ? JSON.stringify(metadata) : existing.metadata;

    run(
      'UPDATE artifacts SET title = ?, content = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [newTitle, newContent, newMetadata, now, id]
    );

    return {
      success: true,
      data: {
        ...rowToArtifact(existing),
        title: newTitle,
        content: newContent,
        metadata: metadata || (existing.metadata ? JSON.parse(existing.metadata) : null),
        updatedAt: now,
      },
    };
  });

  // Delete artifact
  fastify.delete<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<ArtifactRow>('SELECT id FROM artifacts WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    // Delete from file system
    await deleteStoredArtifact(id);

    // Delete from database
    run('DELETE FROM artifacts WHERE id = ?', [id]);
    return { success: true };
  });

  // Download artifact file
  fastify.get<{ Params: { id: string } }>('/artifacts/:id/download', async (request, reply) => {
    const { id } = request.params;
    const row = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    // Try to get file from storage
    const storedArtifact = await getStoredArtifact(id);
    if (!storedArtifact) {
      // If no file, return content from database
      if (row.content) {
        return reply
          .header('Content-Type', row.mime_type || 'text/plain')
          .header('Content-Disposition', `attachment; filename="${row.title}"`)
          .send(row.content);
      }
      return reply.status(404).send({ success: false, error: 'Artifact content not found' });
    }

    // Read file content
    const content = await readArtifactContent(id);
    if (content === null) {
      return reply.status(404).send({ success: false, error: 'Artifact file not found' });
    }

    return reply
      .header('Content-Type', storedArtifact.mimeType)
      .header('Content-Disposition', `attachment; filename="${storedArtifact.filename}"`)
      .send(content);
  });

  // Preview artifact (for images, code, etc.)
  fastify.get<{ Params: { id: string } }>('/artifacts/:id/preview', async (request, reply) => {
    const { id } = request.params;
    const row = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    // Try to get file from storage
    const storedArtifact = await getStoredArtifact(id);
    if (!storedArtifact) {
      // If no file, return content from database for preview
      if (row.content) {
        const mimeType = row.mime_type || 'text/plain';
        return reply
          .header('Content-Type', mimeType)
          .send(row.content);
      }
      return reply.status(404).send({ success: false, error: 'Artifact content not found' });
    }

    // Read file content
    const content = await readArtifactContent(id);
    if (content === null) {
      return reply.status(404).send({ success: false, error: 'Artifact file not found' });
    }

    // For images, set appropriate content type for inline display
    return reply
      .header('Content-Type', storedArtifact.mimeType)
      .header('Cache-Control', 'public, max-age=3600')
      .send(content);
  });
}
