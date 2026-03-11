# 会话管理优化设计文档

## 概述

优化 Openclaw Dashboard 的会话管理功能，包括持久化修复、重命名、置顶和消息气泡样式改进。

## 需求

| 功能 | 具体实现 |
|-----|---------|
| 持久化对话 | 修复前后端问题，确保刷新/重启后数据不丢失 |
| 重命名会话 | 悬停时显示编辑按钮，点击编辑 |
| 置顶会话 | 悬停显示图标，置顶会话排最前，用图标标识 |
| 消息气泡 | ChatGPT 风格（用户右/AI左，不同颜色） |

## 技术方案

### 1. 数据模型变更

#### 数据库 Schema

文件：`apps/server/src/db/schema.sql`

```sql
-- conversations 表添加 pinned 字段
ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0;
```

#### 类型定义

文件：`packages/shared/types/src/index.ts`

```typescript
interface Conversation {
  id: string;
  title: string;
  pinned: boolean;  // 新增
  created_at: string;
  updated_at: string;
}
```

### 2. 后端 API 变更

#### 持久化修复

文件：`apps/server/src/db/index.ts`

- 确保每次写操作后调用 `saveDatabase()` 保存到文件
- 添加数据库初始化时的错误处理

#### 会话路由修改

文件：`apps/server/src/routes/conversations.ts`

| API | 变更 |
|-----|-----|
| `GET /api/conversations` | 返回列表按 `pinned DESC, updated_at DESC` 排序 |
| `PATCH /api/conversations/:id` | 支持更新 `title` 和 `pinned` 字段 |

**请求示例：**

```typescript
// 重命名
PATCH /api/conversations/:id
{ "title": "新标题" }

// 置顶/取消置顶
PATCH /api/conversations/:id
{ "pinned": true }
```

### 3. 前端状态管理变更

#### chatStore 更新

文件：`apps/web/src/stores/chatStore.ts`

```typescript
// 新增 actions
renameConversation: (id: string, title: string) => void
togglePinConversation: (id: string) => void
```

- 修改 `loadConversations`：请求 API 后直接使用返回的排序

#### useWebSocket 更新

文件：`apps/web/src/hooks/useWebSocket.ts`

- 添加 `loadHistory()` 函数，页面加载时调用
- 获取会话列表和当前会话的历史消息
- 处理 `history.conversations` 消息类型

### 4. UI 组件变更

#### Sidebar 会话项

文件：`apps/web/src/components/layout/Sidebar.tsx`

悬停时显示操作按钮：

```
┌─────────────────────────────────┐
│ 📌 会话标题            ✏️ 📌  │  ← 悬停时显示
└─────────────────────────────────┘
```

- 置顶图标：点击切换置顶状态，已置顶显示实心图标
- 编辑图标：点击进入内联编辑模式，回车保存

#### MessageItem 气泡样式

文件：`apps/web/src/components/chat/MessageItem.tsx`

```
AI 消息（左对齐）：              用户消息（右对齐）：
┌──────────────────┐              ┌──────────────────┐
│ 消息内容...      │              │ 消息内容...      │
└──────────────────┘              └──────────────────┘
 bg-neutral-800                   bg-primary-600
```

样式规格：
- 用户消息：靠右，`bg-primary-600` (sky-600)
- AI 消息：靠左，`bg-neutral-800`
- 最大宽度约 70%，圆角 `rounded-2xl`

## 涉及文件清单

### 后端
- `apps/server/src/db/schema.sql` - 添加 pinned 字段
- `apps/server/src/db/index.ts` - 修复持久化保存
- `apps/server/src/routes/conversations.ts` - 修改 API

### 前端
- `packages/shared/types/src/index.ts` - 类型定义
- `apps/web/src/stores/chatStore.ts` - 状态管理
- `apps/web/src/hooks/useWebSocket.ts` - 加载历史
- `apps/web/src/components/layout/Sidebar.tsx` - 会话列表
- `apps/web/src/components/chat/MessageItem.tsx` - 消息气泡

## 实施顺序

1. 数据库 schema 更新 + 持久化修复
2. 后端 API 修改
3. 前端类型定义 + 状态管理
4. WebSocket 历史加载
5. Sidebar 会话操作 UI
6. MessageItem 气泡样式
