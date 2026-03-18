/**
 * Automations API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface AutomationRow {
  id: string;
  title: string;
  description: string | null;
  agent_id: string;
  schedule: string;
  schedule_description: string | null;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Basic cron expression validator
 * Checks if the cron expression has 5 parts and each part is valid
 */
function validateCronExpression(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Helper to validate a cron field
  const isValidField = (field: string, min: number, max: number): boolean => {
    if (field === '*') return true;
    // Handle */n format
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return !isNaN(step) && step > 0 && step <= max;
    }
    // Handle comma-separated values
    if (field.includes(',')) {
      return field.split(',').every(v => isValidField(v, min, max));
    }
    // Handle ranges
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v, 10));
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
    }
    // Simple number
    const num = parseInt(field, 10);
    return !isNaN(num) && num >= min && num <= max;
  };

  return (
    isValidField(minute, 0, 59) &&
    isValidField(hour, 0, 23) &&
    isValidField(dayOfMonth, 1, 31) &&
    isValidField(month, 1, 12) &&
    isValidField(dayOfWeek, 0, 6)
  );
}

/**
 * Calculate the next run time based on cron expression
 * This is a simplified implementation that estimates the next run
 */
function calculateNextRunAt(cron: string): string | null {
  if (!validateCronExpression(cron)) {
    return null;
  }

  const parts = cron.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const now = new Date();
  const next = new Date(now);

  // Simple estimation logic:
  // For simplicity, we'll add a reasonable interval based on the cron pattern
  // A full cron parser would be needed for accurate calculation

  if (minute === '*') {
    // Every minute
    next.setMinutes(next.getMinutes() + 1);
  } else if (minute.startsWith('*/')) {
    // Every N minutes
    const step = parseInt(minute.slice(2), 10);
    next.setMinutes(Math.ceil(next.getMinutes() / step) * step);
    if (next <= now) {
      next.setMinutes(next.getMinutes() + step);
    }
  } else if (hour === '*') {
    // Every hour at specified minute
    next.setHours(next.getHours() + 1);
    next.setMinutes(parseInt(minute, 10));
  } else if (dayOfMonth === '*') {
    // Daily at specified time
    next.setDate(next.getDate() + 1);
    next.setHours(parseInt(hour, 10));
    next.setMinutes(parseInt(minute, 10));
  } else {
    // Default: add 24 hours for more complex patterns
    next.setDate(next.getDate() + 1);
    next.setHours(parseInt(hour, 10) || 0);
    next.setMinutes(parseInt(minute, 10) || 0);
  }

  next.setSeconds(0);
  next.setMilliseconds(0);

  return next.toISOString();
}

function rowToAutomation(row: AutomationRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    agentId: row.agent_id,
    schedule: row.schedule,
    scheduleDescription: row.schedule_description,
    status: row.status,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function automationRoutes(fastify: FastifyInstance) {
  // List automations (optionally filtered by status)
  fastify.get<{
    Querystring: { status?: string; agentId?: string };
  }>('/automations', async (request, reply) => {
    const { status, agentId } = request.query;

    let sql = "SELECT * FROM automations WHERE status != 'deleted'";
    const params: (string | number | null)[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (agentId) {
      sql += ' AND agent_id = ?';
      params.push(agentId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = all<AutomationRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToAutomation),
    };
  });

  // Get single automation
  fastify.get<{ Params: { id: string } }>('/automations/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<AutomationRow>('SELECT * FROM automations WHERE id = ?', [id]);

    if (!row || row.status === 'deleted') {
      return reply.status(404).send({ success: false, error: 'Automation not found' });
    }

    return { success: true, data: rowToAutomation(row) };
  });

  // Create automation
  fastify.post<{
    Body: {
      title: string;
      description?: string;
      agentId: string;
      schedule: string;
      scheduleDescription?: string;
      status?: 'active' | 'paused';
    };
  }>('/automations', async (request, reply) => {
    const { title, description, agentId, schedule, scheduleDescription, status } = request.body;

    // Validate cron expression
    if (!validateCronExpression(schedule)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid cron expression. Expected 5-part cron format (minute hour day-of-month month day-of-week)',
      });
    }

    const id = `automation_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    const nextRunAt = status !== 'paused' ? calculateNextRunAt(schedule) : null;

    run(
      `INSERT INTO automations (id, title, description, agent_id, schedule, schedule_description, status, last_run_at, next_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        description || null,
        agentId,
        schedule,
        scheduleDescription || null,
        status || 'active',
        null,
        nextRunAt,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        title,
        description,
        agentId,
        schedule,
        scheduleDescription,
        status: status || 'active',
        lastRunAt: null,
        nextRunAt,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update automation
  fastify.put<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      agentId?: string;
      schedule?: string;
      scheduleDescription?: string;
      status?: 'active' | 'paused';
    };
  }>('/automations/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, description, agentId, schedule, scheduleDescription, status } = request.body;

    const existing = get<AutomationRow>('SELECT * FROM automations WHERE id = ?', [id]);
    if (!existing || existing.status === 'deleted') {
      return reply.status(404).send({ success: false, error: 'Automation not found' });
    }

    // Validate new cron expression if provided
    const newSchedule = schedule !== undefined ? schedule : existing.schedule;
    if (schedule !== undefined && !validateCronExpression(schedule)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid cron expression. Expected 5-part cron format (minute hour day-of-month month day-of-week)',
      });
    }

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title : existing.title;
    const newDescription = description !== undefined ? description : existing.description;
    const newAgentId = agentId !== undefined ? agentId : existing.agent_id;
    const newScheduleDescription = scheduleDescription !== undefined ? scheduleDescription : existing.schedule_description;
    const newStatus = status !== undefined ? status : existing.status;

    // Recalculate next run if schedule or status changed
    let nextRunAt = existing.next_run_at;
    if (schedule !== undefined || status !== undefined) {
      nextRunAt = newStatus === 'paused' ? null : calculateNextRunAt(newSchedule);
    }

    run(
      `UPDATE automations SET title = ?, description = ?, agent_id = ?, schedule = ?, schedule_description = ?, status = ?, next_run_at = ?, updated_at = ? WHERE id = ?`,
      [newTitle, newDescription, newAgentId, newSchedule, newScheduleDescription, newStatus, nextRunAt, now, id]
    );

    return {
      success: true,
      data: {
        ...rowToAutomation(existing),
        title: newTitle,
        description: newDescription,
        agentId: newAgentId,
        schedule: newSchedule,
        scheduleDescription: newScheduleDescription,
        status: newStatus,
        nextRunAt,
        updatedAt: now,
      },
    };
  });

  // Delete automation (soft delete)
  fastify.delete<{ Params: { id: string } }>('/automations/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<AutomationRow>('SELECT * FROM automations WHERE id = ?', [id]);

    if (!existing || existing.status === 'deleted') {
      return reply.status(404).send({ success: false, error: 'Automation not found' });
    }

    const now = new Date().toISOString();
    run("UPDATE automations SET status = 'deleted', updated_at = ? WHERE id = ?", [now, id]);
    return { success: true };
  });

  // Trigger immediate execution
  fastify.post<{ Params: { id: string } }>('/automations/:id/run', async (request, reply) => {
    const { id } = request.params;
    const existing = get<AutomationRow>('SELECT * FROM automations WHERE id = ?', [id]);

    if (!existing || existing.status === 'deleted') {
      return reply.status(404).send({ success: false, error: 'Automation not found' });
    }

    if (existing.status === 'paused') {
      return reply.status(400).send({ success: false, error: 'Cannot run a paused automation' });
    }

    const now = new Date().toISOString();
    const nextRunAt = calculateNextRunAt(existing.schedule);

    // Update last_run_at and next_run_at
    run(
      'UPDATE automations SET last_run_at = ?, next_run_at = ?, updated_at = ? WHERE id = ?',
      [now, nextRunAt, now, id]
    );

    // TODO: Trigger actual execution via orchestrator or message queue
    // For now, just return success and the execution info
    // This would integrate with the orchestrator service in a full implementation

    return {
      success: true,
      data: {
        id,
        triggeredAt: now,
        nextRunAt,
        message: 'Automation triggered successfully. Execution will be handled by the scheduler.',
      },
    };
  });
}
