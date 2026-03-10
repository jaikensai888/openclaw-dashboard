/**
 * Task Manager Service
 * Manages task lifecycle and state
 */

import { v4 as uuidv4 } from 'uuid';
import { get, run, all } from '../db/index.js';
import type { TaskStatus, TaskType } from '@openclaw-dashboard/shared';

export interface Task {
  id: string;
  conversationId: string;
  type: TaskType;
  title: string | null;
  status: TaskStatus;
  progress: number;
  progressMessage: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface TaskOutput {
  id: string;
  taskId: string;
  sequence: number;
  type: 'text' | 'code' | 'image' | 'file' | 'link';
  content: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateTaskInput {
  conversationId: string;
  type: TaskType;
  title?: string;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  progress?: number;
  progressMessage?: string;
  errorMessage?: string;
}

class TaskManager {
  private tasks: Map<string, Task> = new Map();

  /**
   * Create a new task
   */
  create(input: CreateTaskInput): Task {
    const id = `task_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO tasks (id, conversation_id, type, title, status, started_at, created_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?)`,
      [id, input.conversationId, input.type, input.title || null, now, now]
    );

    const task: Task = {
      id,
      conversationId: input.conversationId,
      type: input.type,
      title: input.title || null,
      status: 'running',
      progress: 0,
      progressMessage: null,
      errorMessage: null,
      startedAt: new Date(now),
      completedAt: null,
      createdAt: new Date(now),
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Get task by ID
   */
  get(taskId: string): Task | null {
    // Check cache first
    const cached = this.tasks.get(taskId);
    if (cached) return cached;

    // Query database
    const row = get<{
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
    }>(
      `SELECT * FROM tasks WHERE id = ?`,
      [taskId]
    );

    if (!row) return null;

    const task: Task = {
      id: row.id,
      conversationId: row.conversation_id,
      type: row.type as TaskType,
      title: row.title,
      status: row.status as TaskStatus,
      progress: row.progress,
      progressMessage: row.progress_message,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Update task status/progress
   */
  update(taskId: string, input: UpdateTaskInput): Task | null {
    const task = this.get(taskId);
    if (!task) return null;

    const updates: string[] = [];
    const params: (string | number | null | Uint8Array)[] = [];

    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.progress !== undefined) {
      updates.push('progress = ?');
      params.push(input.progress);
    }
    if (input.progressMessage !== undefined) {
      updates.push('progress_message = ?');
      params.push(input.progressMessage);
    }
    if (input.errorMessage !== undefined) {
      updates.push('error_message = ?');
      params.push(input.errorMessage);
    }

    if (updates.length === 0) return task;

    // Handle completion
    if (input.status === 'completed' || input.status === 'failed' || input.status === 'cancelled') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }

    params.push(taskId);

    run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Invalidate cache
    this.tasks.delete(taskId);

    return this.get(taskId);
  }

  /**
   * Get all tasks for a conversation
   */
  getByConversation(conversationId: string): Task[] {
    const rows = all<{
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
    }>(
      `SELECT * FROM tasks WHERE conversation_id = ? ORDER BY created_at DESC`,
      [conversationId]
    );

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      type: row.type as TaskType,
      title: row.title,
      status: row.status as TaskStatus,
      progress: row.progress,
      progressMessage: row.progress_message,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Add output to a task
   */
  addOutput(taskId: string, output: Omit<TaskOutput, 'id' | 'taskId' | 'sequence' | 'createdAt'>): TaskOutput {
    // Get next sequence number
    const row = get<{ max_seq: number }>(
      `SELECT COALESCE(MAX(sequence), -1) as max_seq FROM task_outputs WHERE task_id = ?`,
      [taskId]
    );
    const sequence = (row?.max_seq ?? -1) + 1;

    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO task_outputs (id, task_id, sequence, type, content, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, taskId, sequence, output.type, output.content, JSON.stringify(output.metadata || null), now]
    );

    return {
      id,
      taskId,
      sequence,
      type: output.type,
      content: output.content,
      metadata: output.metadata || null,
      createdAt: new Date(now),
    };
  }

  /**
   * Get all outputs for a task
   */
  getOutputs(taskId: string): TaskOutput[] {
    const rows = all<{
      id: string;
      task_id: string;
      sequence: number;
      type: string;
      content: string | null;
      metadata: string | null;
      created_at: string;
    }>(
      `SELECT * FROM task_outputs WHERE task_id = ? ORDER BY sequence ASC`,
      [taskId]
    );

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      sequence: row.sequence,
      type: row.type as TaskOutput['type'],
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Mark task as completed
   */
  complete(taskId: string): Task | null {
    return this.update(taskId, {
      status: 'completed',
      progress: 100,
    });
  }

  /**
   * Mark task as failed
   */
  fail(taskId: string, errorMessage: string): Task | null {
    return this.update(taskId, {
      status: 'failed',
      errorMessage,
    });
  }
}

export const taskManager = new TaskManager();
