/**
 * Categories API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CategoryWithCount extends CategoryRow {
  expert_count: number;
}

function rowToCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function categoryRoutes(fastify: FastifyInstance) {
  // List all categories with expert counts
  fastify.get('/categories', async (request, reply) => {
    const rows = all<CategoryWithCount>(`
      SELECT c.*, COUNT(e.id) as expert_count
      FROM categories c
      LEFT JOIN experts e ON c.name = e.category
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    return {
      success: true,
      data: rows.map((row) => ({
        ...rowToCategory(row),
        expertCount: row.expert_count,
      })),
    };
  });

  // Get single category
  fastify.get<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    return { success: true, data: rowToCategory(row) };
  });

  // Create category
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      sortOrder?: number;
    };
  }>('/categories', async (request, reply) => {
    const { name, description, sortOrder } = request.body;

    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: 'Category name is required' });
    }

    // Check for duplicate name
    const existing = get<CategoryRow>('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing) {
      return reply.status(409).send({ success: false, error: 'Category name already exists' });
    }

    const id = `cat_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO categories (id, name, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), description || null, sortOrder || 0, now, now]
    );

    return {
      success: true,
      data: {
        id,
        name: name.trim(),
        description: description || null,
        sortOrder: sortOrder || 0,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update category
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      sortOrder?: number;
    };
  }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, sortOrder } = request.body;

    const existing = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    // Check for duplicate name if name is being changed
    if (name !== undefined && name !== existing.name) {
      const duplicate = get<CategoryRow>('SELECT id FROM categories WHERE name = ? AND id != ?', [name.trim(), id]);
      if (duplicate) {
        return reply.status(409).send({ success: false, error: 'Category name already exists' });
      }
    }

    const now = new Date().toISOString();
    const newName = name !== undefined ? name.trim() : existing.name;
    const newDescription = description !== undefined ? description : existing.description;
    const newSortOrder = sortOrder !== undefined ? sortOrder : existing.sort_order;

    run(
      `UPDATE categories SET name = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [newName, newDescription, newSortOrder, now, id]
    );

    // If category name changed, update all experts with old category
    if (newName !== existing.name) {
      run(`UPDATE experts SET category = ? WHERE category = ?`, [newName, existing.name]);
    }

    return {
      success: true,
      data: {
        id,
        name: newName,
        description: newDescription,
        sortOrder: newSortOrder,
        createdAt: existing.created_at,
        updatedAt: now,
      },
    };
  });

  // Delete category
  fastify.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    // Set all experts with this category to null (uncategorized)
    run(`UPDATE experts SET category = NULL WHERE category = ?`, [existing.name]);

    // Delete the category
    run('DELETE FROM categories WHERE id = ?', [id]);

    return { success: true };
  });
}
