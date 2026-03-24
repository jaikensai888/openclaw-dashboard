/**
 * BE-03: 规则 API 接口
 *
 * 文件：apps/server/src/routes/rules.ts
 */

import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/index.js';

// 类型定义
interface Rule {
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

interface CreateRuleInput {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}

interface UpdateRuleInput {
  name?: string;
  description?: string;
  template?: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}

export async function rulesRoutes(app: FastifyInstance) {
  const db = getDatabase();

  // GET /api/v1/rules - 获取规则列表
  app.get('/api/v1/rules', async (request, reply) => {
    const { enabled } = request.query as { enabled?: string };

    let sql = 'SELECT * FROM rules';
    const params: (string | number)[] = [];

    if (enabled !== undefined) {
      sql += ' WHERE is_enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY priority DESC, created_at ASC';

    const rules = db.exec(sql, params);
    const result = rules.length > 0 ? rules[0].values : [];

    return result.map((row: unknown[]) => ({
      id: row[0],
      name: row[1],
      description: row[2],
      template: row[3],
      variables: row[4],
      is_enabled: row[5],
      priority: row[6],
      created_at: row[7],
      updated_at: row[8],
    }));
  });

  // GET /api/v1/rules/:id - 获取单个规则
  app.get('/api/v1/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = db.exec('SELECT * FROM rules WHERE id = ?', [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    const row = result[0].values[0];
    return {
      id: row[0],
      name: row[1],
      description: row[2],
      template: row[3],
      variables: row[4],
      is_enabled: row[5],
      priority: row[6],
      created_at: row[7],
      updated_at: row[8],
    };
  });

  // POST /api/v1/rules - 创建规则
  app.post('/api/v1/rules', async (request, reply) => {
    const input = request.body as CreateRuleInput;

    if (!input.name || !input.template) {
      return reply.status(400).send({ error: 'name and template are required' });
    }

    const id = `rule_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    const variables = input.variables ? JSON.stringify(input.variables) : null;
    const isEnabled = input.is_enabled !== false ? 1 : 0;
    const priority = input.priority ?? 0;

    db.exec(
      `INSERT INTO rules (id, name, description, template, variables, is_enabled, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.description || null, input.template, variables, isEnabled, priority, now, now]
    );

    return reply.status(201).send({
      id,
      name: input.name,
      description: input.description || null,
      template: input.template,
      variables,
      is_enabled: isEnabled,
      priority,
      created_at: now,
      updated_at: now,
    });
  });

  // PUT /api/v1/rules/:id - 更新规则
  app.put('/api/v1/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = request.body as UpdateRuleInput;

    // 检查规则是否存在
    const existing = db.exec('SELECT * FROM rules WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.template !== undefined) {
      updates.push('template = ?');
      values.push(input.template);
    }
    if (input.variables !== undefined) {
      updates.push('variables = ?');
      values.push(JSON.stringify(input.variables));
    }
    if (input.is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(input.is_enabled ? 1 : 0);
    }
    if (input.priority !== undefined) {
      updates.push('priority = ?');
      values.push(input.priority);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.exec(`UPDATE rules SET ${updates.join(', ')} WHERE id = ?`, values);

    // 返回更新后的规则
    const result = db.exec('SELECT * FROM rules WHERE id = ?', [id]);
    const row = result[0].values[0];

    return {
      id: row[0],
      name: row[1],
      description: row[2],
      template: row[3],
      variables: row[4],
      is_enabled: row[5],
      priority: row[6],
      created_at: row[7],
      updated_at: row[8],
    };
  });

  // DELETE /api/v1/rules/:id - 删除规则
  app.delete('/api/v1/rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = db.exec('SELECT id FROM rules WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    db.exec('DELETE FROM rules WHERE id = ?', [id]);

    return { success: true };
  });

  // PATCH /api/v1/rules/:id/toggle - 启用/禁用规则
  app.patch('/api/v1/rules/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled: boolean };

    const existing = db.exec('SELECT * FROM rules WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return reply.status(404).send({ error: 'Rule not found' });
    }

    const now = new Date().toISOString();
    const isEnabled = enabled ? 1 : 0;

    db.exec('UPDATE rules SET is_enabled = ?, updated_at = ? WHERE id = ?', [isEnabled, now, id]);

    const result = db.exec('SELECT * FROM rules WHERE id = ?', [id]);
    const row = result[0].values[0];

    return {
      id: row[0],
      name: row[1],
      description: row[2],
      template: row[3],
      variables: row[4],
      is_enabled: row[5],
      priority: row[6],
      created_at: row[7],
      updated_at: row[8],
    };
  });
}
