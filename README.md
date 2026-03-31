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
│   └── prd/                          # 设计文档
│
├── package.json                      # Monorepo 根配置
└── pnpm-workspace.yaml
```

## 架构

Dashboard 通过 WebSocket 直连 Openclaw Gateway，实现 AI Agent 交互：

```
浏览器 (Next.js)  ──WebSocket──►  Dashboard Server  ──WebSocket──►  Openclaw Gateway
                    (ws://:3002/ws)                  (ws://:18789)
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
pnpm dev:server   # 后端 :3002
pnpm dev:web      # 前端 :3000
```

### 环境变量

```bash
# .env (根目录)
SERVER_PORT=3002

# Gateway 连接配置
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3002/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3002/ws
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

**前端连接**: `ws://localhost:3002/ws`

消息类型：
- `conversation.create` - 创建会话
- `conversation.switch` - 切换会话
- `chat.send` - 发送消息
- `task.cancel` - 取消任务

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

### Phase 2: Gateway 直连 ✅
- [x] Gateway WebSocket 客户端
- [x] Orchestrator 编排服务
- [x] 多 Agent 协作 (虚拟 Agent + 交接)
- [x] 专家系统集成
- [x] 规则模板注入

### Phase 3: 核心功能 (进行中)
- [x] 消息解析器 (任务标记)
- [x] 任务管理器
- [x] Zustand 状态管理
- [x] 流式输出支持
- [ ] 远程连接支持

## 下一步

1. 安装依赖: `pnpm install`
2. 配置环境变量 (设置 Gateway URL 和 Token)
3. 启动开发服务器: `./run.sh`

## License

MIT
