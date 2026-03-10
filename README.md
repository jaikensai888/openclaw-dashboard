# Openclaw Dashboard

一个用于 Openclaw Agent 的 Web 聊天界面，类似于 ChatGPT。

## 项目结构

```
openclaw-dashboard/
├── apps/
│   ├── web/                          # Next.js 前端
│   │   ├── src/
│   │   │   ├── app/                  # App Router 页面
│   │   │   ├── components/           # React 组件
│   │   │   ├── hooks/                # 自定义 hooks
│   │   │   ├── stores/               # Zustand 状态管理
│   │   │   └── lib/                  # 工具函数
│   │   └── package.json
│   │
│   └── server/                       # Fastify 后端
│       ├── src/
│       │   ├── routes/               # API 路由
│       │   ├── services/             # 业务逻辑
│       │   ├── db/                   # 数据库
│       │   └── index.ts              # 入口
│       └── package.json
│
├── packages/
│   └── shared/
│       └── types/                    # 共享类型定义
│
├── docs/
│   └── plans/
│       └── 2026-03-05-openclaw-dashboard-design.md
│
├── package.json                      # Monorepo 根配置
└── pnpm-workspace.yaml
```

## 技术栈

### 前端
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand (状态管理)
- Lucide Icons

### 后端
- Node.js 18+
- Fastify
- WebSocket (@fastify/websocket)
- SQLite (better-sqlite3)
- Zod (验证)

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
# 启动所有服务
pnpm dev

# 或者分别启动
pnpm dev:server   # 后端 :3001
pnpm dev:web      # 前端 :3000
```

### 环境变量

```bash
# server/.env
PORT=3001
HOST=0.0.0.0
DB_PATH=./data/dashboard.db
PLUGIN_TOKEN=your-secure-token

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

## API 端点

### HTTP REST

- `GET /api/v1/conversations` - 获取会话列表
- `POST /api/v1/conversations` - 创建新会话
- `GET /api/v1/conversations/:id` - 获取会话详情
- `DELETE /api/v1/conversations/:id` - 删除会话
- `GET /api/v1/conversations/:id/messages` - 获取消息列表
- `GET /api/v1/tasks/:id` - 获取任务详情
- `POST /api/v1/tasks/:id/cancel` - 取消任务

### WebSocket

**前端连接**: `ws://localhost:3001/ws`

消息类型：
- `conversation.create` - 创建会话
- `conversation.switch` - 切换会话
- `chat.send` - 发送消息
- `task.cancel` - 取消任务

**插件连接**: `ws://localhost:3001/ws/plugin`

## Openclaw 插件

Dashboard 插件位于 `packages/dashboard-plugin/`，需要安装到 Openclaw 服务器。

### 安装

```bash
# 从源码安装
cd packages/dashboard-plugin
openclaw plugins install .

# 或安装已发布的包
openclaw plugins install @openclaw-dashboard/dashboard-plugin
```

### 配置

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "dashboard": {
      "enabled": true,
      "backendUrl": "ws://your-dashboard-server:3001/ws/plugin",
      "pluginToken": "your-secure-token"
    }
  }
}
```

### ⚠️ 重要：Agent Provider 配置

Dashboard 插件依赖 Openclaw Agent 正确配置 AI Provider。如果看到以下错误：

```
Agent failed before reply: No API key found for provider "anthropic"
```

请确保正确配置以下文件：

1. **`~/.openclaw/agents/main/agent/models.json`** - 定义 Provider 和模型
2. **`~/.openclaw/agents/main/agent/auth-profiles.json`** - 配置 API Key

详细配置请参考 [配置指南](./docs/CONFIGURATION_GUIDE.md#openclaw-agent-配置重要)。

## 任务协议

Agent 通过内联标记报告任务状态：

```
[TASK:START:type:title]     # 开始任务
[TASK:PROGRESS:percent:msg] # 更新进度
[TASK:DONE]                  # 完成任务
[TASK:FAILED:error]          # 任务失败
```

任务类型：`research`, `code`, `file`, `command`, `custom`

## 开发进度

### Phase 1: 基础框架 ✅
- [x] 项目结构 (Monorepo)
- [x] 后端基础框架 (Fastify + SQLite)
- [x] 前端基础框架 (Next.js 14)
- [x] WebSocket 连接 (前端 ↔ 后端)
- [x] REST API (会话、消息、任务)

### Phase 2: Dashboard 插件 ✅
- [x] 插件项目结构
- [x] Channel 插件定义
- [x] Gateway (WebSocket 连接)
- [x] Outbound (消息发送)
- [x] 配置解析

### Phase 3: 核心功能 (进行中)
- [x] 消息解析器 (任务标记)
- [x] 任务管理器
- [x] Zustand 状态管理
- [ ] 完整的流式输出支持
- [ ] 插件认证机制

### Phase 4: UI 完善
- [x] 基础组件 (Sidebar, ChatPanel, MessageList)
- [x] 任务卡片组件
- [x] 任务详情模态框
- [ ] 历史消息加载
- [ ] 错误处理与重连
- [ ] 响应式布局

## 下一步

1. 安装依赖: `pnpm install`
2. 配置环境变量
3. 启动开发服务器: `pnpm dev`
4. 在 Openclaw 中安装插件

**详细部署步骤请参考 [部署指南](./docs/DEPLOYMENT_GUIDE.md)**

## License

MIT
