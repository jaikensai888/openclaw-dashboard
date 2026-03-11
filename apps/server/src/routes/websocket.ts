/**
 * Frontend WebSocket Routes
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';
import { pluginManager } from '../services/pluginManager.js';
import { messageParser } from '../services/messageParser.js';
import { taskManager } from '../services/taskManager.js';
import type { TaskType } from '@openclaw-dashboard/shared';

interface ClientConnection {
  ws: WebSocket;
  currentConversationId: string | null;
}

const clients = new Map<WebSocket, ClientConnection>();

export async function websocketRoutes(fastify: FastifyInstance) {
  // Register plugin message handlers
  setupPluginMessageHandlers();

  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
      const ws = socket;
      console.log('[WS] Frontend client connected');

      clients.set(ws, {
        ws,
        currentConversationId: null,
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleClientMessage(ws, message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
          sendError(ws, 'PARSE_ERROR', 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        console.log('[WS] Frontend client disconnected');
        clients.delete(ws);
      });

      send(ws, 'connected', { message: 'Connected to Dashboard Backend' });
    });
  });
}

function handleClientMessage(ws: WebSocket, message: { type: string; payload?: unknown }) {
  const { type, payload } = message;
  console.log(`[WS] Received message type: ${type}`, payload);

  switch (type) {
    case 'ping':
      send(ws, 'pong', {});
      break;

    case 'conversation.create':
      handleCreateConversation(ws, payload as { title?: string });
      break;

    case 'conversation.switch':
      handleSwitchConversation(ws, payload as { conversationId: string });
      break;

    case 'chat.send':
      handleChatSend(ws, payload as { conversationId: string; content: string });
      break;

    case 'task.cancel':
      handleTaskCancel(ws, payload as { taskId: string });
      break;

    case 'history.load':
      handleHistoryLoad(ws);
      break;

    case 'conversation.rename':
      handleRenameConversation(ws, payload as { conversationId: string; title: string });
      break;

    case 'conversation.togglePin':
      handleTogglePin(ws, payload as { conversationId: string });
      break;

    default:
      sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
  }
}

async function handleCreateConversation(ws: WebSocket, payload: { id?: string; title?: string }) {
  const conversationId = payload.id || `conv_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();

  run(
    `INSERT INTO conversations (id, title, pinned, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
    [conversationId, payload.title || null, now, now]
  );

  const client = clients.get(ws);
  if (client) {
    client.currentConversationId = conversationId;
  }

  send(ws, 'conversation.created', {
    id: conversationId,
    title: payload.title || null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });
}

async function handleSwitchConversation(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;

  const conv = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);
  if (!conv) {
    sendError(ws, 'NOT_FOUND', 'Conversation not found');
    return;
  }

  const client = clients.get(ws);
  if (client) {
    client.currentConversationId = conversationId;
  }

  // Load messages
  const messages = all<{
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    message_type: string;
    task_id: string | null;
    metadata: string | null;
    created_at: string;
  }>(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`, [conversationId]);

  send(ws, 'history.messages', {
    conversationId,
    messages: messages.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      messageType: m.message_type,
      taskId: m.task_id,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      createdAt: m.created_at,
    })),
  });
}

async function handleChatSend(ws: WebSocket, payload: { conversationId: string; content: string; tempId?: string }) {
  const { conversationId, content, tempId } = payload;

  console.log(`[WS] handleChatSend: conversationId=${conversationId}, content=${content}, tempId=${tempId}`);

  let conv = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);

  // Auto-create conversation if it doesn't exist (frontend may have created it locally)
  if (!conv) {
    console.log(`[WS] Auto-creating conversation: ${conversationId}`);
    const now = new Date().toISOString();
    run(
      `INSERT INTO conversations (id, title, pinned, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
      [conversationId, null, now, now]
    );
    conv = { id: conversationId };
  }

  const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();

  run(
    `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
     VALUES (?, ?, 'user', ?, 'text', ?)`,
    [messageId, conversationId, content, now]
  );

  run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);

  broadcast('chat.message', {
    id: messageId,
    conversationId,
    role: 'user',
    content,
    messageType: 'text',
    tempId,  // 回传给前端用于乐观更新匹配
    createdAt: now,
  });

  // Forward to plugin
  const accountIds = pluginManager.getConnectedAccountIds();
  console.log(`[WS] Connected plugin accounts: ${accountIds.length > 0 ? accountIds.join(', ') : 'none'}`);

  if (accountIds.length > 0) {
    const sent = pluginManager.send(accountIds[0], {
      type: 'user.message',
      payload: {
        conversationId,
        content,
        messageId,
      },
    });
    console.log(`[WS] Forwarded to plugin ${accountIds[0]}: ${sent ? 'success' : 'failed'}`);
  } else {
    console.log(`[WS] No plugin connected, showing error message`);
    const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const errorMsg = 'Openclaw 未连接。请确保 Dashboard 插件已安装并运行。';

    run(
      `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
       VALUES (?, ?, 'assistant', ?, 'text', ?)`,
      [assistantMessageId, conversationId, errorMsg, now]
    );

    broadcast('chat.message', {
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: errorMsg,
      messageType: 'text',
      createdAt: now,
    });
  }
}

async function handleTaskCancel(ws: WebSocket, payload: { taskId: string }) {
  const { taskId } = payload;
  const task = taskManager.get(taskId);

  if (!task) {
    sendError(ws, 'NOT_FOUND', 'Task not found');
    return;
  }

  if (task.status !== 'running') {
    sendError(ws, 'INVALID_STATE', 'Task is not running');
    return;
  }

  taskManager.update(taskId, { status: 'cancelled' });
  broadcast('task.updated', {
    taskId,
    status: 'cancelled',
  });
}

async function handleHistoryLoad(ws: WebSocket) {
  const conversations = all<{
    id: string;
    title: string | null;
    pinned: number;
    created_at: string;
    updated_at: string;
  }>(`SELECT id, title, pinned, created_at, updated_at FROM conversations ORDER BY pinned DESC, updated_at DESC LIMIT 50`);

  send(ws, 'history.conversations', {
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title,
      pinned: c.pinned === 1,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
  });
}

async function handleRenameConversation(ws: WebSocket, payload: { conversationId: string; title: string }) {
  const { conversationId, title } = payload;

  const existing = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);
  if (!existing) {
    sendError(ws, 'NOT_FOUND', 'Conversation not found');
    return;
  }

  const now = new Date().toISOString();
  run(`UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`, [title, now, conversationId]);

  broadcast('conversation.updated', {
    id: conversationId,
    title,
    updatedAt: now,
  });
}

async function handleTogglePin(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;

  const existing = get<{ id: string; pinned: number }>(
    `SELECT id, pinned FROM conversations WHERE id = ?`,
    [conversationId]
  );
  if (!existing) {
    sendError(ws, 'NOT_FOUND', 'Conversation not found');
    return;
  }

  const newPinned = existing.pinned === 1 ? 0 : 1;
  const now = new Date().toISOString();
  run(`UPDATE conversations SET pinned = ?, updated_at = ? WHERE id = ?`, [newPinned, now, conversationId]);

  broadcast('conversation.updated', {
    id: conversationId,
    pinned: newPinned === 1,
    updatedAt: now,
  });
}

function setupPluginMessageHandlers() {
  pluginManager.onMessage('plugin.auth', (data) => {
    const { accountId } = data.payload as { accountId: string };
    pluginManager.authenticate(accountId);
    pluginManager.send(accountId, {
      type: 'plugin.auth.success',
      payload: {},
    });
  });

  pluginManager.onMessage('agent.message', (data) => {
    const payload = data.payload as { conversationId: string; content: string };
    handleAgentMessage(payload.conversationId, payload.content);
  });

  pluginManager.onMessage('agent.message.streaming', (data) => {
    const payload = data.payload as { conversationId: string; delta: string };
    broadcast('chat.streaming', {
      conversationId: payload.conversationId,
      delta: payload.delta,
      done: false,
    });
  });

  pluginManager.onMessage('agent.message.done', (data) => {
    const payload = data.payload as { conversationId: string };
    broadcast('chat.streaming', {
      conversationId: payload.conversationId,
      delta: '',
      done: true,
    });
  });

  pluginManager.onMessage('agent.media', (data) => {
    const payload = data.payload as { conversationId: string; text?: string; mediaUrl: string };
    const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    if (payload.text) {
      run(
        `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
         VALUES (?, ?, 'assistant', ?, 'text', ?)`,
        [messageId, payload.conversationId, payload.text, now]
      );
    }

    broadcast('chat.message', {
      id: messageId,
      conversationId: payload.conversationId,
      role: 'assistant',
      content: payload.text || `[Media: ${payload.mediaUrl}]`,
      messageType: 'text',
      metadata: { mediaUrl: payload.mediaUrl },
      createdAt: now,
    });
  });
}

function handleAgentMessage(conversationId: string, content: string) {
  const parsed = messageParser.parse(content);
  const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();

  if (parsed.messageType === 'task_start' && parsed.taskInfo) {
    const task = taskManager.create({
      conversationId,
      type: (parsed.taskInfo.type || 'custom') as TaskType,
      title: parsed.taskInfo.title,
    });

    run(
      `INSERT INTO messages (id, conversation_id, role, content, message_type, task_id, created_at)
       VALUES (?, ?, 'assistant', ?, 'task_start', ?, ?)`,
      [messageId, conversationId, parsed.cleanContent, task.id, now]
    );

    broadcast('task.created', task);
    broadcast('chat.message', {
      id: messageId,
      conversationId,
      role: 'assistant',
      content: parsed.cleanContent,
      messageType: 'task_start',
      taskId: task.id,
      createdAt: now,
    });
  } else if (parsed.messageType === 'task_update' && parsed.taskInfo) {
    const tasks = taskManager.getByConversation(conversationId);
    const activeTask = tasks.find(t => t.status === 'running');

    if (activeTask && parsed.taskInfo.progress !== undefined) {
      taskManager.update(activeTask.id, {
        progress: parsed.taskInfo.progress,
        progressMessage: parsed.taskInfo.message,
      });

      broadcast('task.updated', {
        taskId: activeTask.id,
        progress: parsed.taskInfo.progress,
        progressMessage: parsed.taskInfo.message,
      });
    }

    if (parsed.cleanContent) {
      run(
        `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
         VALUES (?, ?, 'assistant', ?, 'task_update', ?)`,
        [messageId, conversationId, parsed.cleanContent, now]
      );

      broadcast('chat.message', {
        id: messageId,
        conversationId,
        role: 'assistant',
        content: parsed.cleanContent,
        messageType: 'task_update',
        taskId: activeTask?.id,
        createdAt: now,
      });
    }
  } else if (parsed.messageType === 'task_end') {
    const tasks = taskManager.getByConversation(conversationId);
    const activeTask = tasks.find(t => t.status === 'running');

    if (activeTask) {
      if (parsed.taskInfo?.status === 'failed') {
        taskManager.fail(activeTask.id, parsed.taskInfo.errorMessage || 'Unknown error');
        broadcast('task.failed', {
          taskId: activeTask.id,
          error: parsed.taskInfo.errorMessage,
        });
      } else {
        taskManager.complete(activeTask.id);
        broadcast('task.completed', taskManager.get(activeTask.id));
      }
    }

    if (parsed.cleanContent) {
      run(
        `INSERT INTO messages (id, conversation_id, role, content, message_type, task_id, created_at)
         VALUES (?, ?, 'assistant', ?, 'task_end', ?, ?)`,
        [messageId, conversationId, parsed.cleanContent, activeTask?.id || null, now]
      );

      broadcast('chat.message', {
        id: messageId,
        conversationId,
        role: 'assistant',
        content: parsed.cleanContent,
        messageType: 'task_end',
        taskId: activeTask?.id,
        createdAt: now,
      });
    }
  } else {
    run(
      `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
       VALUES (?, ?, 'assistant', ?, 'text', ?)`,
      [messageId, conversationId, content, now]
    );

    broadcast('chat.message', {
      id: messageId,
      conversationId,
      role: 'assistant',
      content,
      messageType: 'text',
      createdAt: now,
    });
  }

  run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);
}

function send(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sendError(ws: WebSocket, code: string, message: string) {
  send(ws, 'error', { code, message });
}

function broadcast(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload });
  for (const client of clients.values()) {
    if (client.ws.readyState === 1) {
      client.ws.send(message);
    }
  }
}
