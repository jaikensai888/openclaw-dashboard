/**
 * Experts API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface ExpertRow {
  id: string;
  name: string;
  avatar: string | null;
  title: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  color: string | null;
  icon: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function rowToExpert(row: ExpertRow) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    title: row.title,
    description: row.description,
    category: row.category,
    systemPrompt: row.system_prompt,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function expertRoutes(fastify: FastifyInstance) {
  // List experts (optionally filtered by category)
  fastify.get<{
    Querystring: { category?: string };
  }>('/experts', async (request, reply) => {
    const { category } = request.query;

    let sql = 'SELECT * FROM experts WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (category === 'null') {
      // Filter for uncategorized experts
      sql += ' AND category IS NULL';
    } else if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_default DESC, name ASC';

    const rows = all<ExpertRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToExpert),
    };
  });

  // Get unique categories with counts
  fastify.get('/experts/categories', async (request, reply) => {
    const rows = all<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM experts GROUP BY category ORDER BY category ASC'
    );
    return {
      success: true,
      data: rows,
    };
  });

  // Get single expert
  fastify.get<{ Params: { id: string } }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<ExpertRow>('SELECT * FROM experts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    return { success: true, data: rowToExpert(row) };
  });

  // Create expert
  fastify.post<{
    Body: {
      name: string;
      avatar?: string;
      title: string;
      description?: string;
      category: string;
      systemPrompt: string;
      color?: string;
      icon?: string;
      isDefault?: boolean;
    };
  }>('/experts', async (request, reply) => {
    const { name, avatar, title, description, category, systemPrompt, color, icon, isDefault } = request.body;
    const id = `expert_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO experts (id, name, avatar, title, description, category, system_prompt, color, icon, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        avatar || null,
        title,
        description || null,
        category,
        systemPrompt,
        color || null,
        icon || null,
        isDefault ? 1 : 0,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        name,
        avatar,
        title,
        description,
        category,
        systemPrompt,
        color,
        icon,
        isDefault: isDefault || false,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update expert
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      avatar?: string;
      title?: string;
      description?: string;
      category?: string;
      systemPrompt?: string;
      color?: string;
      icon?: string;
      isDefault?: boolean;
    };
  }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, avatar, title, description, category, systemPrompt, color, icon, isDefault } = request.body;

    const existing = get<ExpertRow>('SELECT * FROM experts WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    const now = new Date().toISOString();
    const newName = name !== undefined ? name : existing.name;
    const newAvatar = avatar !== undefined ? avatar : existing.avatar;
    const newTitle = title !== undefined ? title : existing.title;
    const newDescription = description !== undefined ? description : existing.description;
    const newCategory = category !== undefined ? category : existing.category;
    const newSystemPrompt = systemPrompt !== undefined ? systemPrompt : existing.system_prompt;
    const newColor = color !== undefined ? color : existing.color;
    const newIcon = icon !== undefined ? icon : existing.icon;
    const newIsDefault = isDefault !== undefined ? (isDefault ? 1 : 0) : existing.is_default;

    run(
      `UPDATE experts SET name = ?, avatar = ?, title = ?, description = ?, category = ?, system_prompt = ?, color = ?, icon = ?, is_default = ?, updated_at = ? WHERE id = ?`,
      [newName, newAvatar, newTitle, newDescription, newCategory, newSystemPrompt, newColor, newIcon, newIsDefault, now, id]
    );

    return {
      success: true,
      data: {
        ...rowToExpert(existing),
        name: newName,
        avatar: newAvatar,
        title: newTitle,
        description: newDescription,
        category: newCategory,
        systemPrompt: newSystemPrompt,
        color: newColor,
        icon: newIcon,
        isDefault: newIsDefault === 1,
        updatedAt: now,
      },
    };
  });

  // Delete expert
  fastify.delete<{ Params: { id: string } }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<ExpertRow>('SELECT id FROM experts WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    run('DELETE FROM experts WHERE id = ?', [id]);
    return { success: true };
  });
}
