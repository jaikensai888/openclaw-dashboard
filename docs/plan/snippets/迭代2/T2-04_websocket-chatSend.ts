/**
 * 任务 T2-04: websocket.ts - handleChatSend 简化后版本
 * 目标文件: apps/server/src/routes/websocket.ts
 *
 * 变更点:
 * 1. 移除 pluginManager 导入
 * 2. 移除 setupPluginMessageHandlers() 调用和整个函数
 * 3. handleChatSend 中移除 plugin fallback，仅保留 Gateway 直连
 */

// ===== 变更 1: 移除导入 =====
// 删除: import { pluginManager } from '../services/pluginManager.js';

// ===== 变更 2: 移除 setupPluginMessageHandlers() 调用 =====
// 在 websocketRoutes 函数中删除第 33 行:
//   setupPluginMessageHandlers();

// ===== 变更 3: handleChatSend 简化 =====
// 以下是 handleChatSend 函数从第 262 行开始的完整替换代码

async function handleChatSend(ws: WebSocket, payload?: {
  conversationId: string;
  content: string;
  tempId?: string;
  virtualAgentId?: VirtualAgentId;
  expertId?: string;
}) {
  if (!payload) {
    console.error('[WS] handleChatSend: payload is undefined');
    send(ws, 'error', { code: 'INVALID_PAYLOAD', message: 'Missing payload' });
    return;
  }

  const { conversationId, content, tempId, virtualAgentId, expertId } = payload;
  console.log(`[WS] handleChatSend: conversationId=${conversationId}, content=${content}, tempId=${tempId}, virtualAgentId=${virtualAgentId}`);

  let conv = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);

  // Auto-create conversation if it doesn't exist
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
    tempId,
    createdAt: now,
  });

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

  // Gateway 直连模式（唯一模式）
  const orchestrator = getOrchestrator();
  const gatewayClient = getGatewayClient();
  const gatewayConnected = gatewayClient?.isConnected();

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
      // Gateway 返回错误，通知用户
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
    }
  } else {
    // Gateway 未连接
    console.log(`[WS] Gateway not connected, showing error message`);
    const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const errorMsg = 'Gateway 未连接。请检查 OPENCLAW_GATEWAY_URL 和 OPENCLAW_GATEWAY_TOKEN 配置是否正确。';

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

// ===== 变更 4: 删除整个 setupPluginMessageHandlers 函数 =====
// 删除第 433-489 行的整个 setupPluginMessageHandlers() 函数
// 该函数处理: plugin.auth, agent.message, agent.message.streaming, agent.message.done, agent.media
// 这些全部通过 Gateway 的 orchestrator handler 处理，不再需要
