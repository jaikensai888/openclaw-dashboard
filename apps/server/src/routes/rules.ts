/**
 * Rules API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string | null;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string[];
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    template: row.template,
    variables: row.variables ? JSON.parse(row.variables) : [],
    isEnabled: row.is_enabled === 1,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function rulesRoutes(fastify: FastifyInstance) {
  // List rules (支持 enabled 过滤)
  fastify.get<{
    Querystring: { enabled?: string };
  }>('/rules', async (request, reply) => {
    const { enabled } = request.query;

    let sql = 'SELECT * FROM rules WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (enabled !== undefined) {
      sql += ' AND is_enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY priority DESC, created_at ASC';

    const rows = all<RuleRow>(sql, params);
    return rows.map(rowToRule);
  });

  // Get single rule
  fastify.get<{
    Params: { id: string };
  }>('/rules/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<RuleRow>('SELECT * FROM rules WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    return rowToRule(row);
  });

  // Create rule
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      template: string;
      variables?: string[];
      isEnabled?: boolean;
      priority?: number;
    };
  }>('/rules', async (request, reply) => {
    const { name, description, template, variables, isEnabled, priority } = request.body;

    if (!name || !template) {
      return reply.status(400).send({ success: false, error: 'name and template are required' });
    }

    const id = `rule_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO rules (id, name, description, template, variables, is_enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        description || null,
        template,
        variables ? JSON.stringify(variables) : null,
        isEnabled !== false ? 0 : 1,
        priority ?? 1,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        name,
        description: description || null,
        template,
        variables: variables || [],
        isEnabled: isEnabled !== false,
        priority: priority ?? 1,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update rule
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      template?: string;
      variables?: string[];
      isEnabled?: boolean;
      priority?: number;
    };
  }>('/rules/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, template, variables, isEnabled, priority } = request.body;

    const existing = get<RuleRow>('SELECT id FROM rules WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (template !== undefined) {
      updates.push('template = ?');
      values.push(template);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      values.push(JSON.stringify(variables));
    }
    if (isEnabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(isEnabled ? 1 : 0);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    run(`UPDATE rules SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = get<RuleRow>('SELECT * FROM rules WHERE id = ?', [id]);
    return {
      success: true,
      data: rowToRule(updated!),
    };
  });

  // Delete rule
  fastify.delete<{
    Params: { id: string };
  }>('/rules/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = get<RuleRow>('SELECT id FROM rules WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    run('DELETE FROM rules WHERE id = ?', [id]);
    return { success: true };
  });

  // Toggle rule enabled status
  fastify.patch<{
    Params: { id: string };
    Body: { enabled: boolean };
  }>('/rules/:id/toggle', async (request, reply) => {
    const { id } = request.params;
    const { enabled } = request.body;

    const existing = get<RuleRow>('SELECT * FROM rules WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Rule not found' });
    }

    const now = new Date().toISOString();
    run(
      'UPDATE rules SET is_enabled = ?, updated_at = ? WHERE id = ?',
      [enabled ? 1 : 0, now, id]
    );

    const updated = get<RuleRow>('SELECT * FROM rules WHERE id = ?', [id]);
    return {
      success: true,
      data: rowToRule(updated!),
    };
  });
}
