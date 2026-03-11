# 聊天界面增强实施计划

## 概述

实现三个核心功能：
1. **会话历史持久化** - 页面刷新后保留历史会话
2. **会话重命名** - 支持自定义会话标题
3. **会话置顶** - 重要会话置顶显示

## 当前架构分析

### 前端 (`apps/web`)
- `src/stores/chatStore.ts` - Zustand 状态管理
- `src/hooks/useWebSocket.ts` - WebSocket 连接
- `src/app/page.tsx` - 主页面
- `src/components/layout/Sidebar.tsx` - 侧边栏会话列表

### 后端 (`apps/server`)
- `src/db/schema.sql` - SQLite 数据库 schema
- `src/routes/conversations.ts` - 会话 CRUD API
- `src/routes/websocket.ts` - WebSocket 处理

### 共享类型 (`packages/shared/types`)
- `src/index.ts` - 类型定义

---

## 实施步骤

### Phase 1: 数据库 Schema 更新

**文件**: `apps/server/src/db/schema.sql`

```sql
-- 添加 pinned 字段
ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0;
```

### Phase 2: 共享类型更新

**文件**: `packages/shared/types/src/index.ts`

```typescript
// Conversation 接口添加
interface Conversation {
  id: string;
  title: string;
  pinned: boolean;  // 新增
  created_at: string;
  updated_at: string;
}

// 更新输入类型
interface UpdateConversationInput {
  title?: string;
  pinned?: boolean;  // 新增
}
```

### Phase 3: 后端 API 更新

**文件**: `apps/server/src/routes/conversations.ts`

1. **GET /api/conversations** - 返回按置顶和更新时间排序的列表
2. **PUT /api/conversations/:id** - 支持更新 title 和 pinned

### Phase 4: 后端 WebSocket 更新

**文件**: `apps/server/src/routes/websocket.ts`

添加新消息类型：
- `history.load` - 客户端请求加载历史
- `history.conversations` - 服务端返回会话列表

### Phase 5: 前端 Store 更新

**文件**: `apps/web/src/stores/chatStore.ts`

```typescript
interface ChatStore {
  // 现有...
  conversations: Conversation[];

  // 新增 actions
  loadConversations: (conversations: Conversation[]) => void;
  renameConversation: (id: string, title: string) => void;
  togglePinConversation: (id: string) => void;
}
```

### Phase 6: 前端 WebSocket 更新

**文件**: `apps/web/src/hooks/useWebSocket.ts`

```typescript
// 添加处理函数
const loadHistory = useCallback(() => {
  sendMessage({ type: 'history.load' });
}, [sendMessage]);
```

### Phase 7: 前端页面更新

**文件**: `apps/web/src/app/page.tsx`

```typescript
// 页面加载时获取历史会话
useEffect(() => {
  loadHistory();
}, []);
```

### Phase 8: 侧边栏更新

**文件**: `apps/web/src/components/layout/Sidebar.tsx`

1. 会话项悬停时显示操作按钮
2. 添加重命名按钮和模态框
3. 添加置顶/取消置顶按钮
4. 置顶会话显示置顶图标
5. 置顶会话分组显示在顶部

---

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `apps/server/src/db/schema.sql` | 添加 pinned 字段 |
| `packages/shared/types/src/index.ts` | 类型定义添加 pinned |
| `apps/server/src/routes/conversations.ts` | GET 排序, PUT 支持更新 |
| `apps/server/src/routes/websocket.ts` | 添加历史加载消息类型 |
| `apps/web/src/stores/chatStore.ts` | 添加 conversations 状态和 actions |
| `apps/web/src/hooks/useWebSocket.ts` | 添加 loadHistory 函数 |
| `apps/web/src/app/page.tsx` | 初始化时加载历史 |
| `apps/web/src/components/layout/Sidebar.tsx` | 添加重命名和置顶 UI |

---

## 验收标准

- [ ] 页面刷新后会话列表保持
- [ ] 可以重命名会话标题
- [ ] 可以置顶/取消置顶会话
- [ ] 置顶会话显示在列表顶部
- [ ] 置顶会话显示置顶图标
- [ ] 所有操作通过 WebSocket 实时同步

---

## 风险与注意事项

1. **数据库迁移**: 需要处理已有数据库添加字段的情况
2. **WebSocket 消息顺序**: 确保历史加载在创建新会话之前完成
3. **并发操作**: 重命名和置顶操作需要正确处理状态竞争
