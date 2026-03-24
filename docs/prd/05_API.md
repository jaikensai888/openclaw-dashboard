# Openclaw Dashboard - API 接口规范文档

*版本：1.0 | 状态：已实现 | 更新时间：2026-03-21*

---

## 1. API 概述

### 1.1 设计原则

- **RESTful 风格** - 使用名词复数表示资源，HTTP 方法语义明确
- **统一响应格式** - 所有接口返回统一的 JSON 结构
- **双通道通信** - REST API 用于 CRUD，WebSocket 用于实时通信

### 1.2 Base URL

| 环境 | URL |
|------|-----|
| **开发环境** | `http://localhost:3002/api/v1` |
| **生产环境** | `https://{domain}/api/v1` |

### 1.3 版本管理

URL 路径版本：`/api/v1/...`

---

## 2. 认证与授权

### 2.1 认证方式

| 通道 | 认证方式 | 说明 |
|------|----------|------|
| **REST API** | 无认证 | 本地部署，信任本地连接 |
| **WebSocket (前端)** | 无认证 | 本地部署，信任本地连接 |
| **WebSocket (插件)** | Token 认证 | 通过 `PLUGIN_TOKEN` 环境变量 |

### 2.2 插件认证流程

```json
// 插件连接后发送认证消息
{
  "type": "plugin.auth",
  "payload": {
    "accountId": "plugin-account-id"
  }
}

// 服务器响应
{
  "type": "plugin.auth.success",
  "payload": {}
}
```

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
  "error": "错误信息描述"
}
```

### 3.3 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如名称重复） |
| 500 | 服务器内部错误 |

### 3.4 ID 格式规范

| 实体 | 前缀 | 示例 |
|------|------|------|
| Conversation | `conv_` | `conv_abc123def456` |
| Message | `msg_` | `msg_xyz789ghi012` |
| Task | `task_` | `task_jkl345mno678` |
| Expert | `expert_` | `expert_claw_default` |
| Category | `cat_` | `cat_012pqr345` |
| Automation | `auto_` | `auto_678stu901` |
| Artifact | `artifact_` | `artifact_234vwx567` |

---

## 4. REST API 端点

### 4.1 会话模块 (Conversations)

#### [GET] /api/v1/conversations

**描述**：获取会话列表
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/conversations.ts:19-34`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| - | - | - | - | 无参数，返回最近 50 条 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "conv_abc123",
      "title": "项目讨论",
      "pinned": true,
      "createdAt": "2026-03-21T10:00:00.000Z",
      "updatedAt": "2026-03-21T12:00:00.000Z"
    }
  ]
}
```

---

#### [GET] /api/v1/conversations/:id

**描述**：获取单个会话详情
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/conversations.ts:37-59`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 会话 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "conv_abc123",
    "title": "项目讨论",
    "pinned": true,
    "createdAt": "2026-03-21T10:00:00.000Z",
    "updatedAt": "2026-03-21T12:00:00.000Z"
  }
}
```

**错误响应**

| 状态码 | 错误信息 |
|--------|----------|
| 404 | Conversation not found |

---

#### [POST] /api/v1/conversations

**描述**：创建新会话
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/conversations.ts:62-82`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| title | body | string | 否 | 会话标题 |

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
    "id": "conv_xyz789",
    "title": "新对话",
    "pinned": false,
    "createdAt": "2026-03-21T14:00:00.000Z",
    "updatedAt": "2026-03-21T14:00:00.000Z"
  }
}
```

---

#### [PUT] /api/v1/conversations/:id

**描述**：更新会话（标题、置顶状态）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/conversations.ts:85-119`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 会话 ID |
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
    "id": "conv_abc123",
    "title": "更新后的标题",
    "pinned": true,
    "updatedAt": "2026-03-21T15:00:00.000Z"
  }
}
```

---

#### [DELETE] /api/v1/conversations/:id

**描述**：删除会话（级联删除消息和任务）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/conversations.ts:122-139`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 会话 ID |

**响应示例**

```json
{
  "success": true
}
```

---

### 4.2 消息模块 (Messages)

#### [GET] /api/v1/conversations/:id/messages

**描述**：获取会话的消息列表
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/messages.ts:27-66`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | path | string | 是 | - | 会话 ID |
| limit | query | number | 否 | 50 | 返回数量限制 |
| before | query | string | 否 | - | 分页游标，返回此消息 ID 之前的消息 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "msg_abc123",
      "conversationId": "conv_xyz",
      "role": "user",
      "content": "你好",
      "messageType": "text",
      "taskId": null,
      "metadata": null,
      "createdAt": "2026-03-21T10:00:00.000Z"
    },
    {
      "id": "msg_def456",
      "conversationId": "conv_xyz",
      "role": "assistant",
      "content": "你好！有什么可以帮你的？",
      "messageType": "text",
      "taskId": null,
      "metadata": null,
      "createdAt": "2026-03-21T10:00:05.000Z"
    }
  ]
}
```

---

#### [POST] /api/v1/conversations/:id/messages

**描述**：创建消息（HTTP 方式，通常使用 WebSocket）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/messages.ts:69-109`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 会话 ID |
| content | body | string | 是 | 消息内容 |
| role | body | string | 否 | 角色，默认 "user" |

**请求示例**

```json
{
  "content": "这是一条消息",
  "role": "user"
}
```

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "msg_xyz789",
    "conversationId": "conv_abc",
    "role": "user",
    "content": "这是一条消息",
    "messageType": "text",
    "createdAt": "2026-03-21T16:00:00.000Z"
  }
}
```

---

### 4.3 任务模块 (Tasks)

#### [GET] /api/v1/tasks/:id

**描述**：获取任务详情
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/tasks.ts:35-44`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123",
    "conversationId": "conv_xyz",
    "type": "code",
    "title": "代码审查",
    "status": "running",
    "progress": 65,
    "progressMessage": "正在分析...",
    "errorMessage": null,
    "startedAt": "2026-03-21T10:00:00.000Z",
    "completedAt": null,
    "createdAt": "2026-03-21T09:59:00.000Z"
  }
}
```

---

#### [GET] /api/v1/tasks/:id/outputs

**描述**：获取任务的输出列表
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/tasks.ts:47-61`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "output_001",
      "taskId": "task_abc123",
      "sequence": 1,
      "type": "code",
      "content": "console.log('hello');",
      "metadata": { "language": "javascript" },
      "createdAt": "2026-03-21T10:05:00.000Z"
    }
  ]
}
```

---

#### [POST] /api/v1/tasks/:id/cancel

**描述**：取消正在运行的任务
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/tasks.ts:64-82`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "task_abc123",
    "status": "cancelled"
  }
}
```

**错误响应**

| 状态码 | 错误信息 |
|--------|----------|
| 404 | Task not found |
| 400 | Task is not running or pending |

---

#### [GET] /api/v1/conversations/:id/tasks

**描述**：获取会话关联的所有任务
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/tasks.ts:85-91`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| id | path | string | 是 | 会话 ID |

---

### 4.4 专家模块 (Experts)

#### [GET] /api/v1/experts

**描述**：获取专家列表（支持分类过滤）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:43-66`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| category | query | string | 否 | 分类名称，传 "null" 获取未分类专家 |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "expert_claw_default",
      "name": "Claw",
      "avatar": null,
      "title": "智能助手",
      "description": "通用智能助手",
      "category": "通用",
      "systemPrompt": "你是 Claw...",
      "color": "#0ea5e9",
      "icon": "bot",
      "isDefault": true,
      "createdAt": "2026-03-21T00:00:00.000Z",
      "updatedAt": "2026-03-21T00:00:00.000Z"
    }
  ]
}
```

---

#### [GET] /api/v1/experts/categories

**描述**：获取专家分类统计
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:69-77`

**响应示例**

```json
{
  "success": true,
  "data": [
    { "category": "通用", "count": 1 },
    { "category": "内容", "count": 2 },
    { "category": "数据", "count": 1 }
  ]
}
```

---

#### [GET] /api/v1/experts/:id

**描述**：获取单个专家详情
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:80-89`

---

#### [POST] /api/v1/experts

**描述**：创建新专家
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:92-145`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| name | body | string | 是 | 专家名称 |
| avatar | body | string | 否 | 头像 URL |
| title | body | string | 是 | 头衔 |
| description | body | string | 否 | 简介 |
| category | body | string | 是 | 分类 |
| systemPrompt | body | string | 是 | 系统提示词 |
| color | body | string | 否 | 主题色 |
| icon | body | string | 否 | 图标名称 |
| isDefault | body | boolean | 否 | 是否默认，默认 false |

**请求示例**

```json
{
  "name": "新专家",
  "title": "专业顾问",
  "category": "咨询",
  "systemPrompt": "你是一位专业顾问..."
}
```

---

#### [PUT] /api/v1/experts/:id

**描述**：更新专家信息
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:148-202`

---

#### [DELETE] /api/v1/experts/:id

**描述**：删除专家
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/experts.ts:205-215`

---

### 4.5 分类模块 (Categories)

#### [GET] /api/v1/categories

**描述**：获取分类列表（含专家数量）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/categories.ts:35-51`

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "cat_001",
      "name": "通用",
      "description": "通用类专家",
      "sortOrder": 0,
      "expertCount": 1,
      "createdAt": "2026-03-21T00:00:00.000Z",
      "updatedAt": "2026-03-21T00:00:00.000Z"
    }
  ]
}
```

---

#### [POST] /api/v1/categories

**描述**：创建新分类
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/categories.ts:66-105`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| name | body | string | 是 | 分类名称（唯一） |
| description | body | string | 否 | 分类描述 |
| sortOrder | body | number | 否 | 排序顺序，默认 0 |

**错误响应**

| 状态码 | 错误信息 |
|--------|----------|
| 400 | Category name is required |
| 409 | Category name already exists |

---

#### [PUT] /api/v1/categories/:id

**描述**：更新分类（更新名称时会同步更新专家的分类）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/categories.ts:108-158`

---

#### [DELETE] /api/v1/categories/:id

**描述**：删除分类（专家变为未分类）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/categories.ts:161-176`

---

### 4.6 自动化模块 (Automations)

#### [GET] /api/v1/automations

**描述**：获取自动化列表
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/automations.ts:182-207`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| status | query | string | 否 | 过滤状态：active / paused |
| agentId | query | string | 否 | 过滤 Agent ID |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "auto_001",
      "title": "每日报告",
      "description": "生成每日工作报告",
      "agentId": "claw",
      "schedule": "0 9 * * *",
      "scheduleDescription": "每天 9:00",
      "status": "active",
      "lastRunAt": "2026-03-20T09:00:00.000Z",
      "nextRunAt": "2026-03-21T09:00:00.000Z",
      "createdAt": "2026-03-19T10:00:00.000Z",
      "updatedAt": "2026-03-20T09:00:00.000Z"
    }
  ]
}
```

---

#### [POST] /api/v1/automations

**描述**：创建自动化任务（支持自然语言解析）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/automations.ts:222-306`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| title | body | string | 条件 | 任务名称（可从 input 解析） |
| agentId | body | string | 是 | 执行的 Agent ID |
| schedule | body | string | 条件 | Cron 表达式（可从 input 解析） |
| scheduleDescription | body | string | 否 | 人类可读描述 |
| input | body | string | 条件 | 自然语言输入（如 "每天9点生成报告"） |
| description | body | string | 否 | 任务描述 |
| status | body | string | 否 | active / paused，默认 active |

**自然语言支持**

| 输入 | 解析结果 |
|------|----------|
| "每5分钟检查" | `*/5 * * * *` |
| "每小时" | `0 * * * *` |
| "每天9点" | `0 9 * * *` |
| "每天14:30" | `30 14 * * *` |

**错误响应**

| 状态码 | 错误信息 |
|--------|----------|
| 400 | Missing required fields / Invalid cron expression |

---

#### [PUT] /api/v1/automations/:id

**描述**：更新自动化任务
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/automations.ts:309-369`

---

#### [DELETE] /api/v1/automations/:id

**描述**：删除自动化任务（软删除）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/automations.ts:372-383`

---

#### [POST] /api/v1/automations/:id/run

**描述**：手动触发自动化任务
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/automations.ts:386-420`

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "auto_001",
    "triggeredAt": "2026-03-21T15:00:00.000Z",
    "nextRunAt": "2026-03-22T09:00:00.000Z",
    "message": "Automation triggered successfully."
  }
}
```

---

### 4.7 产物模块 (Artifacts)

#### [GET] /api/v1/artifacts

**描述**：获取产物列表
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:47-71`

**请求参数**

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|--------|------|------|------|------|
| conversationId | query | string | 否 | 过滤会话 ID |
| taskId | query | string | 否 | 过滤任务 ID |

**响应示例**

```json
{
  "success": true,
  "data": [
    {
      "id": "artifact_001",
      "conversationId": "conv_abc",
      "taskId": "task_xyz",
      "type": "code",
      "title": "main.py",
      "content": null,
      "filePath": "/data/conversations/conv_abc/main.py",
      "mimeType": "text/x-python",
      "metadata": { "language": "python" },
      "createdAt": "2026-03-21T10:00:00.000Z",
      "updatedAt": "2026-03-21T10:00:00.000Z"
    }
  ]
}
```

---

#### [GET] /api/v1/artifacts/:id

**描述**：获取产物详情
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:74-83`

---

#### [GET] /api/v1/artifacts/:id/content

**描述**：获取产物内容（JSON 格式）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:264-319`

**响应示例**

```json
{
  "success": true,
  "data": {
    "id": "artifact_001",
    "title": "main.py",
    "type": "code",
    "mimeType": "text/x-python",
    "content": "print('Hello, World!')",
    "isReference": false
  }
}
```

---

#### [GET] /api/v1/artifacts/:id/download

**描述**：下载产物文件
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:195-226`

**响应**: 直接返回文件内容，设置 `Content-Type` 和 `Content-Disposition` 头

---

#### [GET] /api/v1/artifacts/:id/preview

**描述**：预览产物（适用于图片、代码等）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:229-261`

**响应**: 直接返回文件内容，设置 `Content-Type` 和 `Cache-Control` 头

---

#### [POST] /api/v1/artifacts

**描述**：创建产物
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:86-136`

---

#### [PUT] /api/v1/artifacts/:id

**描述**：更新产物
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:139-175`

---

#### [DELETE] /api/v1/artifacts/:id

**描述**：删除产物（同时删除文件）
**实现状态**：✅ 已实现
**代码位置**：`apps/server/src/routes/artifacts.ts:178-192`

---

## 5. WebSocket API

### 5.1 连接

**端点**: `ws://localhost:3002/ws`

**连接成功响应**

```json
{
  "type": "connected",
  "payload": {
    "message": "Connected to Dashboard Backend"
  }
}
```

### 5.2 客户端 → 服务器消息

#### ping

**描述**：心跳检测

```json
{
  "type": "ping",
  "payload": {}
}
```

---

#### conversation.create

**描述**：创建新会话

```json
{
  "type": "conversation.create",
  "payload": {
    "id": "conv_optional_id",
    "title": "新对话"
  }
}
```

**响应**: `conversation.created`

---

#### conversation.switch

**描述**：切换会话（加载消息和产物）

```json
{
  "type": "conversation.switch",
  "payload": {
    "conversationId": "conv_abc123"
  }
}
```

**响应**: `history.messages`, `artifacts.list`

---

#### conversation.rename

**描述**：重命名会话

```json
{
  "type": "conversation.rename",
  "payload": {
    "conversationId": "conv_abc123",
    "title": "新标题"
  }
}
```

**响应**: `conversation.updated`

---

#### conversation.togglePin

**描述**：切换会话置顶状态

```json
{
  "type": "conversation.togglePin",
  "payload": {
    "conversationId": "conv_abc123"
  }
}
```

**响应**: `conversation.updated`

---

#### conversation.delete

**描述**：删除会话

```json
{
  "type": "conversation.delete",
  "payload": {
    "conversationId": "conv_abc123"
  }
}
```

**响应**: `conversation.deleted`

---

#### chat.send

**描述**：发送聊天消息

```json
{
  "type": "chat.send",
  "payload": {
    "conversationId": "conv_abc123",
    "content": "你好",
    "tempId": "temp_001",
    "virtualAgentId": "claw",
    "expertId": "expert_claw_default"
  }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conversationId | string | 是 | 会话 ID |
| content | string | 是 | 消息内容 |
| tempId | string | 否 | 临时 ID（用于乐观更新匹配） |
| virtualAgentId | string | 否 | 指定 Agent |
| expertId | string | 否 | 指定专家 |

**响应**: `chat.message`（用户消息确认）, `chat.streaming`（流式响应）, `chat.message`（AI 回复）

---

#### task.cancel

**描述**：取消任务

```json
{
  "type": "task.cancel",
  "payload": {
    "taskId": "task_abc123"
  }
}
```

**响应**: `task.updated` 或 `error`

---

#### history.load

**描述**：加载历史会话列表

```json
{
  "type": "history.load",
  "payload": {}
}
```

**响应**: `history.conversations`

---

#### agents.list

**描述**：获取可用 Agent 列表

```json
{
  "type": "agents.list",
  "payload": {}
}
```

**响应**: `agents.list`

---

#### artifacts.load

**描述**：加载会话的产物列表

```json
{
  "type": "artifacts.load",
  "payload": {
    "conversationId": "conv_abc123"
  }
}
```

**响应**: `artifacts.list`

---

### 5.3 服务器 → 客户端消息

| 类型 | 说明 | payload 结构 |
|------|------|--------------|
| `connected` | 连接确认 | `{ message: string }` |
| `pong` | 心跳响应 | `{}` |
| `error` | 错误 | `{ code: string, message: string }` |
| `conversation.created` | 会话创建 | Conversation 对象 |
| `conversation.updated` | 会话更新 | `{ id, title?, pinned?, updatedAt }` |
| `conversation.deleted` | 会话删除 | `{ id }` |
| `history.conversations` | 会话历史 | `{ conversations: Conversation[] }` |
| `history.messages` | 消息历史 | `{ conversationId, messages: Message[] }` |
| `chat.message` | 新消息 | Message 对象 |
| `chat.streaming` | 流式响应 | `{ conversationId, delta: string, done: boolean }` |
| `task.created` | 任务创建 | Task 对象 |
| `task.updated` | 任务更新 | `{ taskId, status?, progress?, progressMessage? }` |
| `task.completed` | 任务完成 | Task 对象 |
| `task.failed` | 任务失败 | `{ taskId, error? }` |
| `agents.list` | Agent 列表 | `{ agents: AgentInfo[] }` |
| `agent.active` | Agent 激活 | `{ conversationId, agent: AgentInfo }` |
| `agent.handoff` | Agent 交接 | `{ conversationId, fromAgentId, toAgentId, reason? }` |
| `artifacts.list` | 产物列表 | `{ conversationId, artifacts: Artifact[] }` |
| `artifact.created` | 产物创建 | `{ conversationId, artifact }` |
| `artifact.deleted` | 产物删除 | `{ id }` |

---

## 更新记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-21 | 1.0 | 基于现有代码逆向生成 API 文档 |
