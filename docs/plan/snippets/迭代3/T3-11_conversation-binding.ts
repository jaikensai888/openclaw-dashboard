/**
 * 任务 T3-11: 会话-服务器关联
 * 目标文件: apps/server/src/routes/websocket.ts (修改), apps/web/src/components/layout/Sidebar.tsx (修改)
 *
 * 创建会话时绑定 serverId，前端 Sidebar 的 [+新] 按钮传递 serverId
 */

// ==================== 后端: websocket.ts 修改 ====================
// 在 handleConversationCreate 函数中:

async function handleConversationCreate(payload: any) {
  const { title, expertId, serverId } = payload as {
    title?: string;
    expertId?: string;
    serverId?: string;          // 新增：服务器 ID
  };

  const id = `conv_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const now = new Date().toISOString();
  const conversationTitle = title || '新会话';

  // 创建会话，包含 serverId
  run(
    `INSERT INTO conversations (id, title, created_at, updated_at, expert_id, server_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, conversationTitle, now, now, expertId || null, serverId || null]
  );

  const conversation = get('SELECT * FROM conversations WHERE id = ?', [id]);

  broadcast('conversation.created', { conversation });

  // 自动切换到新会话
  activeConversationId = id;
  broadcast('conversation.switched', { conversationId: id });

  // 加载该会话的消息历史
  const messages = all(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    [id]
  );
  send(socket, 'history.messages', { conversationId: id, messages });
}

// ==================== 前端: Sidebar.tsx 修改 ====================
// 在服务器分组下的 [+新] 按钮，传递 serverId:

// 原始代码 (约 line 459):
// onClick={() => createConversation()}
// 改为:
{serverGroup.servers.map(server => (
  <div key={server.id} className="...">
    <div className="flex items-center justify-between">
      <span className="...">{server.name}</span>
      <button
        onClick={() => createConversation(undefined, server.id)}
        className="..."
        title={`在 ${server.name} 上新建会话`}
      >
        +
      </button>
    </div>
    {/* 该服务器下的会话列表 */}
  </div>
))}

// ==================== 前端: chatStore.ts 修改 ====================
// 在 createConversation action 中添加 serverId 参数:

createConversation: async (title?: string, serverId?: string | null) => {
  const { wsSend } = get();
  if (!wsSend) return;

  wsSend('conversation.create', {
    title: title || '新会话',
    serverId: serverId || null,
  });
},
