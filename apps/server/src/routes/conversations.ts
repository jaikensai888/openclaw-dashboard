/**
 * Conversations API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface ConversationRow {
  id: string;
  title: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export async function conversationRoutes(fastify: FastifyInstance) {
  // List conversations
  fastify.get('/conversations', async (request, reply) => {
    const rows = all<ConversationRow>(
      `SELECT id, title, pinned, created_at, updated_at FROM conversations ORDER BY pinned DESC, updated_at DESC LIMIT 50`
    );

    return {
      success: true,
      data: rows.map(row => ({
        id: row.id,
        title: row.title,
        pinned: row.pinned === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  });

  // Get single conversation
  fastify.get<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const { id } = request.params;

    const row = get<ConversationRow>(
      `SELECT id, title, pinned, created_at, updated_at FROM conversations WHERE id = ?`,
      [id]
    );

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' });
    }

    return {
      success: true,
      data: {
        id: row.id,
        title: row.title,
        pinned: row.pinned === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  });

  // Create conversation
  fastify.post<{ Body: { title?: string } }>('/conversations', async (request, reply) => {
    const { title } = request.body || {};
    const id = `conv_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO conversations (id, title, pinned, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
      [id, title || null, now, now]
    );

    return {
      success: true,
      data: {
        id,
        title: title || null,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update conversation
  fastify.put<{ Params: { id: string }; Body: { title?: string; pinned?: boolean } }>(
    '/conversations/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { title, pinned } = request.body || {};

      const existing = get<ConversationRow>(
        `SELECT id, title, pinned FROM conversations WHERE id = ?`,
        [id]
      );

      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Conversation not found' });
      }

      const now = new Date().toISOString();
      const newTitle = title !== undefined ? title : existing.title;
      const newPinned = pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned;

      run(
        `UPDATE conversations SET title = ?, pinned = ?, updated_at = ? WHERE id = ?`,
        [newTitle, newPinned, now, id]
      );

      return {
        success: true,
        data: {
          id,
          title: newTitle,
          pinned: newPinned === 1,
          updatedAt: now,
        },
      };
    }
  );

  // Delete conversation
  fastify.delete<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = get<ConversationRow>(`SELECT id FROM conversations WHERE id = ?`, [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' });
    }

    // Delete related data (cascade not automatic in SQLite without foreign keys enabled)
    run(`DELETE FROM task_outputs WHERE task_id IN (SELECT id FROM tasks WHERE conversation_id = ?)`, [id]);
    run(`DELETE FROM tasks WHERE conversation_id = ?`, [id]);
    run(`DELETE FROM messages WHERE conversation_id = ?`, [id]);
    run(`DELETE FROM conversations WHERE id = ?`, [id]);

    return { success: true };
  });
}
