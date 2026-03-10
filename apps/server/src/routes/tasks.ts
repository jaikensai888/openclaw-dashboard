/**
 * Tasks API Routes
 */

import type { FastifyInstance } from 'fastify';
import { get, all } from '../db/index.js';
import { taskManager } from '../services/taskManager.js';

interface TaskRow {
  id: string;
  conversation_id: string;
  type: string;
  title: string | null;
  status: string;
  progress: number;
  progress_message: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface TaskOutputRow {
  id: string;
  task_id: string;
  sequence: number;
  type: string;
  content: string | null;
  metadata: string | null;
  created_at: string;
}

export async function taskRoutes(fastify: FastifyInstance) {
  // Get task details
  fastify.get<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    const { id } = request.params;

    const task = taskManager.get(id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found' });
    }

    return { success: true, data: task };
  });

  // Get task outputs
  fastify.get<{ Params: { id: string } }>('/tasks/:id/outputs', async (request, reply) => {
    const { id } = request.params;

    const task = taskManager.get(id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found' });
    }

    const outputs = taskManager.getOutputs(id);

    return {
      success: true,
      data: outputs,
    };
  });

  // Cancel task
  fastify.post<{ Params: { id: string } }>('/tasks/:id/cancel', async (request, reply) => {
    const { id } = request.params;

    const task = taskManager.get(id);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'Task not found' });
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      return reply.status(400).send({
        success: false,
        error: 'Task is not running or pending',
      });
    }

    const updatedTask = taskManager.update(id, { status: 'cancelled' });

    return { success: true, data: updatedTask };
  });

  // Get tasks for conversation
  fastify.get<{ Params: { id: string } }>('/conversations/:id/tasks', async (request, reply) => {
    const { id } = request.params;

    const tasks = taskManager.getByConversation(id);

    return { success: true, data: tasks };
  });
}
