/**
 * Frontend WebSocket Routes
 */

import fs from 'fs';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';
import { messageParser } from '../services/messageParser.js';
import { taskManager } from '../services/taskManager.js';
import { getOrchestrator, type OrchestratorEvent } from '../services/orchestrator.js';
import { getGatewayClient } from '../services/openclawGatewayClient.js';
import { getRemoteConnectionManager } from '../remote/manager.js';
import {
  saveArtifact,
  listArtifacts,
  deleteConversationArtifacts,
  type Artifact,
} from '../services/artifactStorage.js';
import { parseFileSavedMarkers } from '../services/messageParser.js';
import type { TaskType, WSChatSendWithAgentPayload, VirtualAgentId } from '@openclaw-dashboard/shared';

interface ClientConnection {
  ws: WebSocket;
  currentConversationId: string | null;
}

const clients = new Map<WebSocket, ClientConnection>();

export async function websocketRoutes(fastify: FastifyInstance) {
  // Register orchestrator event handlers
  setupOrchestratorHandlers();

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
      handleChatSend(ws, payload as { conversationId: string; content: string; virtualAgentId?: VirtualAgentId; tempId?: string; expertId?: string });
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

    case 'conversation.delete':
      handleDeleteConversation(ws, payload as { conversationId: string });
      break;

    case 'agents.list':
      handleListAgents(ws);
      break;

    case 'artifacts.load':
      handleLoadArtifacts(ws, payload as { conversationId: string });
      break;

    case 'remote.servers':
      handleRemoteServers(ws);
      break;

    case 'remote.switch':
      handleRemoteSwitch(ws, payload as { serverId?: string });
      break;

    case 'directory:list':
      handleDirectoryList(ws, payload as { path: string; recursive?: boolean; serverId?: string });
      break;

    case 'file:read':
      handleFileRead(ws, payload as { path: string; serverId?: string });
      break;

    case 'watch.subscribe':
      handleWatchSubscribe(ws, payload as { path: string; recursive?: boolean; serverId?: string });
      break;

    case 'watch.unsubscribe':
      handleWatchUnsubscribe(ws, payload as { subscriptionId: string; serverId?: string });
      break;

    default:
      sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
  }
}

async function handleCreateConversation(ws: WebSocket, payload?: { id?: string; title?: string; serverId?: string }) {
  const conversationId = payload?.id || `conv_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();

  run(
    `INSERT INTO conversations (id, title, pinned, created_at, updated_at, server_id) VALUES (?, ?, 0, ?, ?, ?)`,
    [conversationId, payload?.title || null, now, now, payload?.serverId || null]
  );

  const client = clients.get(ws);
  if (client) {
    client.currentConversationId = conversationId;
  }

  send(ws, 'conversation.created', {
    id: conversationId,
    title: payload?.title || null,
    pinned: false,
    serverId: payload?.serverId || null,
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

  // Load artifacts for this conversation
  const artifacts = listArtifacts(conversationId);
  send(ws, 'artifacts.list', {
    conversationId,
    artifacts,
  });
}

async function handleChatSend(ws: WebSocket, payload?: {
  conversationId: string;
  content: string;
  tempId?: string;
  virtualAgentId?: VirtualAgentId;
  expertId?: string;  // 新增
}) {
  if (!payload) {
    console.error('[WS] handleChatSend: payload is undefined');
    send(ws, 'error', { code: 'INVALID_PAYLOAD', message: 'Missing payload' });
    return;
  }

  const { conversationId, content, tempId, virtualAgentId, expertId } = payload;

  console.log(`[WS] handleChatSend: conversationId=${conversationId}, content=${content}, tempId=${tempId}, virtualAgentId=${virtualAgentId}`);

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

  // Try Gateway/Orchestrator first
  const orchestrator = getOrchestrator();
  const gatewayClient = getGatewayClient();
  const gatewayConnected = gatewayClient?.isConnected();

  // 查询 expert 的 systemPrompt
  let expertSystemPrompt: string | undefined;
  if (expertId) {
    const expert = get<{ system_prompt: string }>(
      'SELECT system_prompt FROM experts WHERE id = ?',
      [expertId]
    );
    if (expert) {
      expertSystemPrompt = expert.system_prompt;
      console.log(`[WS] Using expert systemPrompt for ${expertId}`);
    }
  }

  if (gatewayConnected) {
    console.log(`[WS] Using Gateway connection`);
    const result = await orchestrator.handleUserMessage({
      conversationId,
      content,
      virtualAgentId,
      expertSystemPrompt,
    });

    if (result.error) {
      console.log(`[WS] Gateway error: ${result.error}`);
      const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const errorMsg = `Gateway 请求失败: ${result.error}`;

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
    } else {
      console.log(`[WS] Gateway accepted, runId: ${result.runId}`);
      return;
    }
  } else {
    console.log(`[WS] Gateway not connected`);
    const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const errorMsg = 'Gateway 未连接。请检查 OPENCLAW_GATEWAY_URL 和 OPENCLAW_GATEWAY_TOKEN 配置。';

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

async function handleDeleteConversation(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;

  const existing = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);
  if (!existing) {
    sendError(ws, 'NOT_FOUND', 'Conversation not found');
    return;
  }

  // Delete artifacts first (file system and database)
  deleteConversationArtifacts(conversationId);

  // Delete messages first (foreign key constraint)
  run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);
  // Delete conversation
  run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);

  broadcast('conversation.deleted', { id: conversationId });
}

async function handleListAgents(ws: WebSocket) {
  const orchestrator = getOrchestrator();
  const agents = orchestrator.getAvailableAgents();
  send(ws, 'agents.list', { agents });
}

async function handleLoadArtifacts(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;
  const artifacts = listArtifacts(conversationId);
  send(ws, 'artifacts.list', {
    conversationId,
    artifacts,
  });
}

function handleAgentMessage(conversationId: string, content: string) {
  // 先解析文件保存标记，获取清理后的内容
  const { filePaths, cleanContent: contentWithoutMarkers } = parseFileSavedMarkers(content);

  const parsed = messageParser.parse(contentWithoutMarkers);
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
      [messageId, conversationId, contentWithoutMarkers, now]
    );

    broadcast('chat.message', {
      id: messageId,
      conversationId,
      role: 'assistant',
      content: contentWithoutMarkers,
      messageType: 'text',
      createdAt: now,
    });
  }

  run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);

  // 处理 FILE_SAVED 标记，记录到产物表（仅路径引用，不保存内容）
  if (filePaths.length > 0) {
    for (const filePath of filePaths) {
      try {
        // 从路径提取文件名
        const filename = filePath.split('/').pop() || filePath;

        // 确定文件类型
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        let artifactType: 'code' | 'image' | 'document' | 'other' = 'document';
        const codeExtensions = ['js', 'ts', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'html', 'css', 'json', 'yaml', 'yml', 'sql', 'sh'];
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

        if (codeExtensions.includes(ext)) {
          artifactType = 'code';
        } else if (imageExtensions.includes(ext)) {
          artifactType = 'image';
        }

        // 构建完整文件路径
        const fullPath = `${process.cwd()}/data/conversations/${conversationId}/${filePath}`;

        // 检查文件是否已存在（AI 可能已经保存了）
        const fileExists = fs.existsSync(fullPath);

        // 如果文件已存在，只注册元数据，不写入文件（避免覆盖 AI 保存的内容）
        // 如果文件不存在，创建空文件占位（等待后续同步）
        const artifact = saveArtifact(
          conversationId,
          filename,
          '',
          artifactType,
          fileExists // 文件存在时标记为引用，避免写入覆盖
        );

        // 更新 file_path 为完整路径，并设置正确的 isReference
        run(
          'UPDATE artifacts SET file_path = ?, metadata = ? WHERE id = ?',
          [fullPath, JSON.stringify({ size: fileExists ? fs.statSync(fullPath).size : 0, isReference: false }), artifact.id]
        );

        // Broadcast artifact creation event
        broadcast('artifact.created', {
          conversationId,
          artifact: { ...artifact, path: fullPath },
        });

        console.log(`[WS] Artifact registered: ${filePath}`);
      } catch (error) {
        console.error('[WS] Failed to register artifact:', error);
      }
    }
  }
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

// ==================== Remote Handlers ====================

async function handleRemoteServers(ws: WebSocket) {
  const servers = all<{
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    private_key_path: string | null;
    remote_port: number;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM remote_servers ORDER BY created_at DESC');

  const manager = getRemoteConnectionManager();
  const statuses = manager ? manager.getAllServersStatus() : [];

  const result = servers.map(server => {
    const status = statuses.find(s => s.serverId === server.id);
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      privateKeyPath: server.private_key_path,
      remotePort: server.remote_port,
      status: status
        ? (status.rpcConnected ? 'connected' : status.tunnelStatus?.status || 'disconnected')
        : 'disconnected',
      createdAt: server.created_at,
      updatedAt: server.updated_at,
    };
  });

  send(ws, 'remote.servers', { servers: result });
}

async function handleRemoteSwitch(ws: WebSocket, payload: { serverId?: string }) {
  const manager = getRemoteConnectionManager();
  if (!manager) {
    sendError(ws, 'NOT_INITIALIZED', '远程连接管理器未初始化');
    return;
  }

  manager.setActiveServer(payload.serverId || null);
  broadcast('remote.active', { activeServerId: payload.serverId || null });
}

async function handleDirectoryList(ws: WebSocket, payload: { path: string; recursive?: boolean; serverId?: string }) {
  const manager = getRemoteConnectionManager();
  const serverId = payload.serverId;

  if (serverId && manager) {
    const client = manager.getClient(serverId) || manager.getActiveClient();
    if (!client || !client.isConnected) {
      sendError(ws, 'NOT_CONNECTED', '远程服务器未连接');
      return;
    }
    try {
      const files = await client.listDirectory(payload.path, payload.recursive);
      send(ws, 'directory:list:result', { files, path: payload.path });
    } catch (error) {
      sendError(ws, 'DIRECTORY_LIST_ERROR', String(error));
    }
  } else {
    sendError(ws, 'NOT_CONNECTED', '未指定远程服务器');
  }
}

async function handleFileRead(ws: WebSocket, payload: { path: string; serverId?: string }) {
  const manager = getRemoteConnectionManager();
  const serverId = payload.serverId;

  if (serverId && manager) {
    const client = manager.getClient(serverId) || manager.getActiveClient();
    if (!client || !client.isConnected) {
      sendError(ws, 'NOT_CONNECTED', '远程服务器未连接');
      return;
    }
    try {
      const content = await client.readFile(payload.path);
      send(ws, 'file:read:result', { content, path: payload.path });
    } catch (error) {
      sendError(ws, 'FILE_READ_ERROR', String(error));
    }
  } else {
    sendError(ws, 'NOT_CONNECTED', '未指定远程服务器');
  }
}

async function handleWatchSubscribe(ws: WebSocket, payload: { path: string; recursive?: boolean; serverId?: string }) {
  const manager = getRemoteConnectionManager();
  const serverId = payload.serverId;

  if (serverId && manager) {
    const client = manager.getClient(serverId) || manager.getActiveClient();
    if (!client || !client.isConnected) {
      sendError(ws, 'NOT_CONNECTED', '远程服务器未连接');
      return;
    }
    try {
      const result = await client.watchSubscribe(payload.path);
      send(ws, 'watch.subscribed', { subscriptionId: result.subscriptionId, path: payload.path });

      // Forward watch events to this WebSocket
      client.onWatchEvent((event) => {
        send(ws, 'watch.event', event);
      });
    } catch (error) {
      sendError(ws, 'WATCH_SUBSCRIBE_ERROR', String(error));
    }
  } else {
    sendError(ws, 'NOT_CONNECTED', '未指定远程服务器');
  }
}

async function handleWatchUnsubscribe(ws: WebSocket, payload: { subscriptionId: string; serverId?: string }) {
  const manager = getRemoteConnectionManager();
  const serverId = payload.serverId;

  if (serverId && manager) {
    const client = manager.getClient(serverId) || manager.getActiveClient();
    if (!client || !client.isConnected) {
      sendError(ws, 'NOT_CONNECTED', '远程服务器未连接');
      return;
    }
    try {
      await client.watchUnsubscribe(payload.subscriptionId);
      send(ws, 'watch.unsubscribed', { subscriptionId: payload.subscriptionId });
    } catch (error) {
      sendError(ws, 'WATCH_UNSUBSCRIBE_ERROR', String(error));
    }
  } else {
    sendError(ws, 'NOT_CONNECTED', '未指定远程服务器');
  }
}

function setupOrchestratorHandlers() {
  const orchestrator = getOrchestrator();

  orchestrator.onEvent((event: OrchestratorEvent) => {
    const { type, conversationId, data } = event;

    switch (type) {
      case 'agent.active':
        broadcast('agent.active', data as { conversationId: string; agent: unknown });
        break;

      case 'agent.handoff':
        broadcast('agent.handoff', {
          conversationId,
          ...(data as { fromAgentId: string; toAgentId: string; reason?: string }),
        });
        break;

      case 'agent.streaming':
        broadcast('chat.streaming', {
          conversationId,
          ...(data as { delta: string; done: boolean }),
        });
        break;

      case 'agent.message':
        {
          const { content } = data as { content: string };

          // 解析文件保存标记
          const { filePaths, cleanContent } = parseFileSavedMarkers(content);

          const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
          const now = new Date().toISOString();

          run(
            `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
             VALUES (?, ?, 'assistant', ?, 'text', ?)`,
            [messageId, conversationId, cleanContent, now]
          );

          run(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);

          broadcast('chat.message', {
            id: messageId,
            conversationId,
            role: 'assistant',
            content: cleanContent,
            messageType: 'text',
            createdAt: now,
          });

          // 处理 FILE_SAVED 标记
          if (filePaths.length > 0) {
            for (const filePath of filePaths) {
              try {
                const filename = filePath.split('/').pop() || filePath;
                const ext = filename.split('.').pop()?.toLowerCase() || '';
                let artifactType: 'code' | 'image' | 'document' | 'other' = 'document';
                const codeExtensions = ['js', 'ts', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'html', 'css', 'json', 'yaml', 'yml', 'sql', 'sh'];
                const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

                if (codeExtensions.includes(ext)) {
                  artifactType = 'code';
                } else if (imageExtensions.includes(ext)) {
                  artifactType = 'image';
                }

                const fullPath = `${process.cwd()}/data/conversations/${conversationId}/${filePath}`;

                // 检查文件是否已存在（AI 可能已经保存了）
                const fileExists = fs.existsSync(fullPath);

                const artifact = saveArtifact(
                  conversationId,
                  filename,
                  '',
                  artifactType,
                  fileExists // 文件存在时标记为引用，避免写入覆盖
                );

                // 更新 file_path 和 metadata
                run(
                  'UPDATE artifacts SET file_path = ?, metadata = ? WHERE id = ?',
                  [fullPath, JSON.stringify({ size: fileExists ? fs.statSync(fullPath).size : 0, isReference: false }), artifact.id]
                );

                broadcast('artifact.created', {
                  conversationId,
                  artifact: { ...artifact, path: fullPath },
                });

                console.log(`[Orchestrator] Artifact registered: ${filePath}`);
              } catch (error) {
                console.error('[Orchestrator] Failed to register artifact:', error);
              }
            }
          }
        }
        break;

      case 'agent.error':
        {
          const { error } = data as { error: string };
          const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
          const now = new Date().toISOString();

          run(
            `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
             VALUES (?, ?, 'assistant', ?, 'text', ?)`,
            [messageId, conversationId, `[错误: ${error}]`, now]
          );

          broadcast('chat.message', {
            id: messageId,
            conversationId,
            role: 'assistant',
            content: `[错误: ${error}]`,
            messageType: 'text',
            createdAt: now,
          });
        }
        break;
    }
  });
}
