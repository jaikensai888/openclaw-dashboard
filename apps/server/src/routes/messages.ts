/**
 * Messages API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  message_type: string;
  task_id: string | null;
  metadata: string | null;
  created_at: string;
}

interface GetMessagesQuery {
  limit?: number;
  before?: string;
}

export async function messageRoutes(fastify: FastifyInstance) {
  // Get messages for a conversation
  fastify.get<{ Params: { id: string }; Querystring: GetMessagesQuery }>(
    '/conversations/:id/messages',
    async (request, reply) => {
      const { id } = request.params;
      const { limit = 50, before } = request.query;

      // Check conversation exists
      const conv = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [id]);
      if (!conv) {
        return reply.status(404).send({ success: false, error: 'Conversation not found' });
      }

      let sql = `SELECT * FROM messages WHERE conversation_id = ?`;
      const params: (string | number | null | Uint8Array)[] = [id];

      if (before) {
        sql += ` AND created_at < (SELECT created_at FROM messages WHERE id = ?)`;
        params.push(before);
      }

      sql += ` ORDER BY created_at ASC LIMIT ?`;
      params.push(limit);

      const rows = all<MessageRow>(sql, params);

      return {
        success: true,
        data: rows.map(row => ({
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role,
          content: row.content,
          messageType: row.message_type,
          taskId: row.task_id,
          metadata: row.metadata ? JSON.parse(row.metadata) : null,
          createdAt: row.created_at,
        })),
      };
    }
  );

  // Create a message (HTTP fallback)
  fastify.post<{
    Params: { id: string };
    Body: { content: string; role?: string };
  }>('/conversations/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const { content, role = 'user' } = request.body;

    if (!content) {
      return reply.status(400).send({ success: false, error: 'Content is required' });
    }

    // Check conversation exists
    const conv = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [id]);
    if (!conv) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' });
    }

    const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
       VALUES (?, ?, ?, ?, 'text', ?)`,
      [messageId, id, role, content, now]
    );

    // Update conversation updated_at
    run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, id]);

    return {
      success: true,
      data: {
        id: messageId,
        conversationId: id,
        role,
        content,
        messageType: 'text',
        createdAt: now,
      },
    };
  });
}
