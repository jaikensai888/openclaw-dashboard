# Openclaw Dashboard - API 接口规范文档

*版本：1.0 | 状态：已确认 | 基于 PRD v1.0 和技术方案 v1.0*

---

## 1. API 概述

### 1.1 设计原则

- **RESTful 风格**：使用名词复数表示资源，HTTP 方法语义明确
- **双协议支持**：HTTP REST + WebSocket 实时通信
- **统一响应格式**：所有接口返回统一的 JSON 结构

### 1.2 Base URL

| 环境 | REST API | WebSocket |
|------|----------|-----------|
| 开发环境 | `http://localhost:3001/api/v1` | `ws://localhost:3001/ws` |
| 生产环境 | `https://{domain}/api/v1` | `wss://{domain}/ws` |

### 1.3 版本管理

- URL 路径版本：`/api/v1/...`
- 当前版本：v1

---

## 2. 认证与授权

### 2.1 认证方式

| 接入方 | 认证方式 | 说明 |
|--------|----------|------|
| 前端 | 无认证 | 个人使用，内网访问 |
| Dashboard 插件 | Token 认证 | Header: `X-Plugin-Token` |

### 2.2 Token 使用（插件）

```http
GET /ws/plugin
Upgrade: websocket
X-Plugin-Token: your-secure-token
```

### 2.3 权限模型

| 角色 | 权限范围 |
|------|----------|
| 前端用户 | 所有 REST API + 前端 WebSocket |
| Dashboard 插件 | 插件 WebSocket + 消息推送 |

---

## 3. 通用规范

### 3.1 请求格式

- **Content-Type**: `application/json`
- **字符编码**: `UTF-8`

### 3.2 响应格式

**成功响应**

```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 3.3 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|----------|
| 200 | 成功 | 请求成功 |
| 400 | 请求错误 | 参数缺失或格式错误 |
| 404 | 未找到 | 资源不存在 |
| 500 | 服务器错误 | 内部错误 |

### 3.4 分页规范

**请求参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | int | 50 | 每页数量，最大 100 |
| before | string | - | 游标，加载此 ID 之前的消息 |

**响应格式**

```json
{
  "success": true,
  "data": [...]
}
```

> 注：当前实现使用游标分页（before），不支持传统 offset 分页

---

## 4. REST API 端点

### 4.1 会话模块

#### [GET] /api/v1/conversations

**描述**：获取会话列表
**认证**：不需要
**实现状态**：✅ 已实现

**请求参数**：无

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "conv_abc123def456",
      "title": "项目讨论",
      "pinned": true,
      "createdAt": "2026-03-11T10:30:00.000Z",
      "updatedAt": "2026-03-11T11:00:00.000Z"
    },
    {
      "id": "conv_xyz789ghi012",
      "title": "新对话",
      "pinned": false,
      "createdAt": "2026-03-10T09:00:00.000Z",
      "updatedAt": "2026-03-10T09:30:00.000Z"
    }
  ]
}
```

---

#### [GET] /api/v1/conversations/:id

**描述**：获取单个会话详情
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID，格式 `conv_xxx` |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "conv_abc123def456",
    "title": "项目讨论",
    "pinned": true,
    "createdAt": "2026-03-11T10:30:00.000Z",
    "updatedAt": "2026-03-11T11:00:00.000Z"
  }
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Conversation not found |

---

#### [POST] /api/v1/conversations

**描述**：创建新会话
**认证**：不需要
**实现状态**：✅ 已实现

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| title | body | string | 否 | 会话标题，不传则为空 |

**请求示例**

```json
{
  "title": "新对话"
}
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "conv_abc123def456",
    "title": "新对话",
    "pinned": false,
    "createdAt": "2026-03-11T10:30:00.000Z",
    "updatedAt": "2026-03-11T10:30:00.000Z"
  }
}
```

---

#### [PUT] /api/v1/conversations/:id

**描述**：更新会话（标题、置顶）
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| title | body | string | 否 | 新标题 |
| pinned | body | boolean | 否 | 是否置顶 |

**请求示例**

```json
{
  "title": "更新后的标题",
  "pinned": true
}
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "conv_abc123def456",
    "title": "更新后的标题",
    "pinned": true,
    "updatedAt": "2026-03-11T11:00:00.000Z"
  }
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Conversation not found |

---

#### [DELETE] /api/v1/conversations/:id

**描述**：删除会话（级联删除消息和任务）
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID |

**响应示例**

```json
{
  "success": true
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Conversation not found |

---

### 4.2 消息模块

#### [GET] /api/v1/conversations/:id/messages

**描述**：获取会话消息列表（支持分页）
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID |

**查询参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | int | 50 | 每页数量 |
| before | string | - | 游标，加载此消息 ID 之前的消息 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "msg_abc123def456",
      "conversationId": "conv_abc123def456",
      "role": "user",
      "content": "你好，帮我分析一下这个项目",
      "messageType": "text",
      "taskId": null,
      "metadata": null,
      "createdAt": "2026-03-11T10:30:00.000Z"
    },
    {
      "id": "msg_xyz789ghi012",
      "conversationId": "conv_abc123def456",
      "role": "assistant",
      "content": "好的，我来帮你分析...",
      "messageType": "text",
      "taskId": null,
      "metadata": null,
      "createdAt": "2026-03-11T10:30:05.000Z"
    }
  ]
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Conversation not found |

---

#### [POST] /api/v1/conversations/:id/messages

**描述**：创建消息（HTTP 备用方式，推荐使用 WebSocket）
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| content | body | string | 是 | 消息内容 |
| role | body | string | 否 | 角色，默认 `user` |

**请求示例**

```json
{
  "content": "你好，帮我分析一下",
  "role": "user"
}
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "msg_abc123def456",
    "conversationId": "conv_abc123def456",
    "role": "user",
    "content": "你好，帮我分析一下",
    "messageType": "text",
    "createdAt": "2026-03-11T10:30:00.000Z"
  }
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 400 | Content is required |
| 404 | Conversation not found |

---

### 4.3 任务模块

#### [GET] /api/v1/tasks/:id

**描述**：获取任务详情
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 任务 ID，格式 `task_xxx` |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123def456",
    "conversationId": "conv_abc123def456",
    "type": "research",
    "title": "分析项目结构",
    "status": "running",
    "progress": 65,
    "progressMessage": "正在整理中...",
    "errorMessage": null,
    "startedAt": "2026-03-11T10:30:00.000Z",
    "completedAt": null,
    "createdAt": "2026-03-11T10:30:00.000Z"
  }
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Task not found |

---

#### [GET] /api/v1/tasks/:id/outputs

**描述**：获取任务输出列表
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "out_abc123",
      "taskId": "task_abc123def456",
      "sequence": 1,
      "type": "text",
      "content": "## 项目结构概述\n\n该项目采用 Monorepo 结构...",
      "metadata": null,
      "createdAt": "2026-03-11T10:31:00.000Z"
    }
  ]
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 404 | Task not found |

---

#### [POST] /api/v1/tasks/:id/cancel

**描述**：取消任务
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123def456",
    "status": "cancelled",
    ...
  }
}
```

**错误响应**

| HTTP 状态码 | error |
|-------------|-------|
| 400 | Task is not running or pending |
| 404 | Task not found |

---

#### [GET] /api/v1/conversations/:id/tasks

**描述**：获取会话的所有任务
**认证**：不需要
**实现状态**：✅ 已实现

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会话 ID |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "task_abc123def456",
      "conversationId": "conv_abc123def456",
      "type": "research",
      "title": "分析项目结构",
      "status": "completed",
      "progress": 100,
      ...
    }
  ]
}
```

---

## 5. WebSocket API

### 5.1 前端 WebSocket

**连接地址**：`ws://localhost:3001/ws`

#### 连接流程

1. 前端建立 WebSocket 连接
2. 服务端返回 `connected` 消息
3. 前端可发送各类操作消息

#### 消息格式

```typescript
interface WSMessage {
  type: string;       // 消息类型
  payload: unknown;   // 消息载荷
}
```

---

### 5.2 前端 → 服务端消息

#### conversation.create

**描述**：创建新会话
**实现状态**：✅ 已实现

```json
{
  "type": "conversation.create",
  "payload": {
    "id": "conv_optional_id",
    "title": "新对话"
  }
}
```

**响应**：`conversation.created`

---

#### conversation.switch

**描述**：切换会话并加载历史消息
**实现状态**：✅ 已实现

```json
{
  "type": "conversation.switch",
  "payload": {
    "conversationId": "conv_abc123def456"
  }
}
```

**响应**：`history.messages`

---

#### conversation.rename

**描述**：重命名会话
**实现状态**：✅ 已实现

```json
{
  "type": "conversation.rename",
  "payload": {
    "conversationId": "conv_abc123def456",
    "title": "新标题"
  }
}
```

**响应**：`conversation.updated`

---

#### conversation.togglePin

**描述**：切换会话置顶状态
**实现状态**：✅ 已实现

```json
{
  "type": "conversation.togglePin",
  "payload": {
    "conversationId": "conv_abc123def456"
  }
}
```

**响应**：`conversation.updated`

---

#### chat.send

**描述**：发送聊天消息
**实现状态**：✅ 已实现

```json
{
  "type": "chat.send",
  "payload": {
    "conversationId": "conv_abc123def456",
    "content": "你好，帮我分析一下",
    "tempId": "temp_1234567890_abc123"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversationId | string | 是 | 会话 ID |
| content | string | 是 | 消息内容 |
| tempId | string | 否 | 临时 ID，用于乐观更新匹配 |

**响应**：`chat.message`

---

#### task.cancel

**描述**：取消任务
**实现状态**：✅ 已实现

```json
{
  "type": "task.cancel",
  "payload": {
    "taskId": "task_abc123def456"
  }
}
```

**响应**：`task.updated` 或 `error`

---

#### history.load

**描述**：加载历史会话列表
**实现状态**：✅ 已实现

```json
{
  "type": "history.load",
  "payload": {}
}
```

**响应**：`history.conversations`

---

#### ping

**描述**：心跳检测
**实现状态**：✅ 已实现

```json
{
  "type": "ping",
  "payload": {}
}
```

**响应**：`pong`

---

### 5.3 服务端 → 前端消息

#### connected

**描述**：连接成功确认

```json
{
  "type": "connected",
  "payload": {
    "message": "Connected to Dashboard Backend"
  }
}
```

---

#### conversation.created

**描述**：会话创建成功

```json
{
  "type": "conversation.created",
  "payload": {
    "id": "conv_abc123def456",
    "title": "新对话",
    "pinned": false,
    "createdAt": "2026-03-11T10:30:00.000Z",
    "updatedAt": "2026-03-11T10:30:00.000Z"
  }
}
```

---

#### conversation.updated

**描述**：会话更新通知

```json
{
  "type": "conversation.updated",
  "payload": {
    "id": "conv_abc123def456",
    "title": "更新后的标题",
    "pinned": true,
    "updatedAt": "2026-03-11T11:00:00.000Z"
  }
}
```

---

#### history.conversations

**描述**：历史会话列表

```json
{
  "type": "history.conversations",
  "payload": {
    "conversations": [
      {
        "id": "conv_abc123def456",
        "title": "项目讨论",
        "pinned": true,
        "createdAt": "2026-03-11T10:30:00.000Z",
        "updatedAt": "2026-03-11T11:00:00.000Z"
      }
    ]
  }
}
```

---

#### history.messages

**描述**：历史消息列表

```json
{
  "type": "history.messages",
  "payload": {
    "conversationId": "conv_abc123def456",
    "messages": [
      {
        "id": "msg_abc123def456",
        "conversationId": "conv_abc123def456",
        "role": "user",
        "content": "你好",
        "messageType": "text",
        "taskId": null,
        "metadata": null,
        "createdAt": "2026-03-11T10:30:00.000Z"
      }
    ]
  }
}
```

---

#### chat.message

**描述**：新消息通知（用户或 Agent）

```json
{
  "type": "chat.message",
  "payload": {
    "id": "msg_abc123def456",
    "conversationId": "conv_abc123def456",
    "role": "assistant",
    "content": "好的，我来帮你分析...",
    "messageType": "text",
    "taskId": null,
    "metadata": null,
    "tempId": "temp_1234567890_abc123",
    "createdAt": "2026-03-11T10:30:05.000Z"
  }
}
```

---

#### chat.streaming

**描述**：流式响应片段

```json
{
  "type": "chat.streaming",
  "payload": {
    "conversationId": "conv_abc123def456",
    "delta": "这是",
    "done": false
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| conversationId | string | 会话 ID |
| delta | string | 增量内容 |
| done | boolean | 是否结束 |

---

#### task.created

**描述**：任务创建通知

```json
{
  "type": "task.created",
  "payload": {
    "id": "task_abc123def456",
    "conversationId": "conv_abc123def456",
    "type": "research",
    "title": "分析项目结构",
    "status": "running",
    "progress": 0,
    ...
  }
}
```

---

#### task.updated

**描述**：任务状态更新

```json
{
  "type": "task.updated",
  "payload": {
    "taskId": "task_abc123def456",
    "progress": 65,
    "progressMessage": "正在整理中..."
  }
}
```

---

#### task.completed

**描述**：任务完成

```json
{
  "type": "task.completed",
  "payload": {
    "id": "task_abc123def456",
    "status": "completed",
    "progress": 100,
    "completedAt": "2026-03-11T10:35:00.000Z",
    ...
  }
}
```

---

#### task.failed

**描述**：任务失败

```json
{
  "type": "task.failed",
  "payload": {
    "taskId": "task_abc123def456",
    "error": "网络连接失败"
  }
}
```

---

#### error

**描述**：错误消息

```json
{
  "type": "error",
  "payload": {
    "code": "NOT_FOUND",
    "message": "Conversation not found"
  }
}
```

**错误码**

| 错误码 | 说明 |
|--------|------|
| PARSE_ERROR | 消息解析失败 |
| UNKNOWN_TYPE | 未知消息类型 |
| NOT_FOUND | 资源不存在 |
| INVALID_STATE | 状态不合法 |

---

### 5.4 插件 WebSocket

**连接地址**：`ws://localhost:3001/ws/plugin`

**认证**：Header `X-Plugin-Token`

#### plugin.auth

**方向**：插件 → 服务端

```json
{
  "type": "plugin.auth",
  "payload": {
    "accountId": "default",
    "pluginVersion": "1.0.0"
  }
}
```

**响应**：`plugin.auth.success` 或 `plugin.auth.failed`

---

#### agent.message

**方向**：插件 → 服务端

```json
{
  "type": "agent.message",
  "payload": {
    "conversationId": "conv_abc123def456",
    "content": "这是完整的响应内容"
  }
}
```

---

#### agent.message.streaming

**方向**：插件 → 服务端

```json
{
  "type": "agent.message.streaming",
  "payload": {
    "conversationId": "conv_abc123def456",
    "delta": "增量内容"
  }
}
```

---

#### agent.message.done

**方向**：插件 → 服务端

```json
{
  "type": "agent.message.done",
  "payload": {
    "conversationId": "conv_abc123def456"
  }
}
```

---

#### agent.media

**方向**：插件 → 服务端

```json
{
  "type": "agent.media",
  "payload": {
    "conversationId": "conv_abc123def456",
    "text": "这是图片说明",
    "mediaUrl": "https://example.com/image.png"
  }
}
```

---

#### user.message（服务端 → 插件）

**方向**：服务端 → 插件

```json
{
  "type": "user.message",
  "payload": {
    "conversationId": "conv_abc123def456",
    "content": "用户输入的消息",
    "messageId": "msg_abc123def456"
  }
}
```

---

## 6. 数据类型定义

### 6.1 Conversation

```typescript
interface Conversation {
  id: string;           // 格式: conv_xxx
  title?: string | null;
  pinned: boolean;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

### 6.2 Message

```typescript
interface Message {
  id: string;           // 格式: msg_xxx
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'task_start' | 'task_update' | 'task_end';
  taskId?: string | null;
  metadata?: Record<string, unknown> | null;
  tempId?: string;      // 仅用于乐观更新匹配
  createdAt: string;    // ISO 8601
}
```

### 6.3 Task

```typescript
interface Task {
  id: string;           // 格式: task_xxx
  conversationId: string;
  type: 'research' | 'code' | 'file' | 'command' | 'custom';
  title?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;     // 0-100
  progressMessage?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;    // ISO 8601
}
```

### 6.4 TaskOutput

```typescript
interface TaskOutput {
  id: string;
  taskId: string;
  sequence: number;
  type: 'text' | 'code' | 'image' | 'file' | 'link';
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;    // ISO 8601
}
```

---

## 7. API 端点总览

### 7.1 REST API

| 方法 | 端点 | 描述 | 状态 |
|------|------|------|------|
| GET | /conversations | 获取会话列表 | ✅ |
| GET | /conversations/:id | 获取会话详情 | ✅ |
| POST | /conversations | 创建会话 | ✅ |
| PUT | /conversations/:id | 更新会话 | ✅ |
| DELETE | /conversations/:id | 删除会话 | ✅ |
| GET | /conversations/:id/messages | 获取消息列表 | ✅ |
| POST | /conversations/:id/messages | 创建消息 | ✅ |
| GET | /tasks/:id | 获取任务详情 | ✅ |
| GET | /tasks/:id/outputs | 获取任务输出 | ✅ |
| POST | /tasks/:id/cancel | 取消任务 | ✅ |
| GET | /conversations/:id/tasks | 获取会话任务 | ✅ |

### 7.2 WebSocket 消息

| 类型 | 方向 | 描述 | 状态 |
|------|------|------|------|
| connected | S→C | 连接确认 | ✅ |
| conversation.create | C→S | 创建会话 | ✅ |
| conversation.created | S→C | 会话创建成功 | ✅ |
| conversation.switch | C→S | 切换会话 | ✅ |
| conversation.rename | C→S | 重命名会话 | ✅ |
| conversation.togglePin | C→S | 切换置顶 | ✅ |
| conversation.updated | S→C | 会话更新通知 | ✅ |
| history.load | C→S | 加载历史 | ✅ |
| history.conversations | S→C | 历史会话列表 | ✅ |
| history.messages | S→C | 历史消息列表 | ✅ |
| chat.send | C→S | 发送消息 | ✅ |
| chat.message | S→C | 新消息通知 | ✅ |
| chat.streaming | S→C | 流式响应 | ✅ |
| task.created | S→C | 任务创建 | ✅ |
| task.updated | S→C | 任务更新 | ✅ |
| task.completed | S→C | 任务完成 | ✅ |
| task.failed | S→C | 任务失败 | ✅ |
| task.cancel | C→S | 取消任务 | ✅ |
| ping/pong | C↔S | 心跳 | ✅ |
| error | S→C | 错误消息 | ✅ |

---

*生成时间：2026-03-11 11:30*

---

## 更新记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-11 | 1.0 | 初始化 API 文档，基于现有后端代码和 PRD 生成 |
