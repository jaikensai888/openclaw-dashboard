# Openclaw Dashboard - 技术架构设计

*版本：1.0 | 状态：已确认 | 项目类型：已有项目*

---

## 1. 技术概述

### 1.1 技术目标

- **高性能**：WebSocket 实时通信，流式响应延迟 < 500ms
- **简洁架构**：Monorepo 结构，前后端分离但统一管理
- **类型安全**：全栈 TypeScript，共享类型定义
- **易于部署**：单机部署，SQLite 数据库，无需复杂基础设施

### 1.2 架构风格

- **前后端分离**：Next.js 前端 + Fastify 后端
- **实时通信**：WebSocket 双向通信
- **插件集成**：通过 Dashboard 插件与 Openclaw Agent 集成
- **状态管理**：Zustand 客户端状态 + SQLite 持久化

### 1.3 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端框架 | Next.js 14 | App Router、服务端渲染、成熟生态 |
| 后端框架 | Fastify | 高性能、原生 WebSocket 支持、TypeScript 友好 |
| 数据库 | SQLite (sql.js) | 轻量级、单机部署、无外部依赖 |
| 状态管理 | Zustand | 轻量、简洁、TypeScript 友好 |
| 实时通信 | WebSocket | 双向通信、流式响应、低延迟 |

---

## 2. 技术栈选择

### 2.1 前端技术栈

| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| Next.js | 14.1.0 | React 框架 | App Router、SSR、文件系统路由 |
| React | 18.2.0 | UI 库 | 组件化、声明式、生态成熟 |
| TypeScript | 5.3.0 | 类型系统 | 类型安全、开发体验 |
| Tailwind CSS | 3.4.0 | 样式系统 | 原子化 CSS、快速开发 |
| Zustand | 4.5.0 | 状态管理 | 轻量、简洁、无样板代码 |
| Lucide React | 0.314.0 | 图标库 | 丰富的图标、Tree-shakable |
| clsx + tailwind-merge | 2.1.0 / 2.2.0 | 样式工具 | 条件样式、类名合并 |
| Vitest | 4.0.18 | 测试框架 | 快速、Vite 原生支持 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| Fastify | 4.26.0 | Web 框架 | 高性能、原生 WebSocket、钩子系统 |
| @fastify/websocket | 10.0.0 | WebSocket 插件 | 原生集成、类型安全 |
| @fastify/cors | 9.0.0 | CORS 支持 | 跨域配置 |
| sql.js | 1.10.0 | SQLite 驱动 | 纯 JavaScript、无需编译 |
| ws | 8.16.0 | WebSocket 库 | 标准实现、性能好 |
| zod | 3.22.0 | 数据验证 | 类型推导、运行时验证 |
| uuid | 9.0.0 | ID 生成 | 标准 UUID |
| TypeScript | 5.3.0 | 类型系统 | 与前端统一 |

### 2.3 共享包

| 包名 | 用途 |
|------|------|
| @openclaw-dashboard/shared | 前后端共享类型定义 |

### 2.4 构建工具

| 工具 | 版本 | 用途 |
|------|------|------|
| pnpm | workspace | Monorepo 包管理 |
| tsx | 4.7.0 | TypeScript 执行器（开发） |
| tsc | 5.3.0 | TypeScript 编译器（构建） |

---

## 3. 系统架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户浏览器                                 │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     Next.js Frontend (:3000)                 │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │   │
│   │   │  App Router │  │  Components │  │  Zustand Store      │ │   │
│   │   └─────────────┘  └─────────────┘  └─────────────────────┘ │   │
│   │                              │                                │   │
│   │              ┌────────────────────────────┐                  │   │
│   │              │    WebSocket Client        │                  │   │
│   │              │    (useWebSocket hook)     │                  │   │
│   │              └────────────────────────────┘                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        WebSocket + HTTP REST
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Dashboard Backend (:3001)                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     Fastify Server                           │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│   │   │  REST Routes │  │  WebSocket   │  │  Plugin Handler  │  │   │
│   │   │  /api/v1/*   │  │  /ws, /ws/p  │  │  (消息路由)       │  │   │
│   │   └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│   │           │                  │                    │          │   │
│   │   ┌───────┴──────────────────┴────────────────────┴───────┐  │   │
│   │   │                    Services Layer                     │  │   │
│   │   │  MessageParser │ TaskManager │ ConnectionManager      │  │   │
│   │   └───────────────────────────────────────────────────────┘  │   │
│   │                              │                                │   │
│   │              ┌────────────────────────────┐                  │   │
│   │              │    SQLite (sql.js)         │                  │   │
│   │              │    ./data/dashboard.db     │                  │   │
│   │              └────────────────────────────┘                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        WebSocket (Dashboard Protocol)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Openclaw Gateway (外部服务)                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  Dashboard Plugin                             │   │
│   │   - Gateway (WS Client)  - Outbound (发送消息)                │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Openclaw Agent                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件

| 组件 | 职责 | 位置 |
|------|------|------|
| **App Router** | 页面路由、服务端渲染 | apps/web/src/app |
| **Components** | UI 组件（Sidebar、ChatPanel、TaskCard 等） | apps/web/src/components |
| **Zustand Store** | 客户端状态管理 | apps/web/src/stores |
| **WebSocket Hook** | 前端 WebSocket 连接管理 | apps/web/src/hooks |
| **REST Routes** | HTTP API 端点 | apps/server/src/routes |
| **WebSocket Server** | 实时通信服务 | apps/server/src/app.ts |
| **Services** | 业务逻辑层 | apps/server/src/services |
| **SQLite** | 数据持久化 | apps/server/src/db |

### 3.3 通信方式

| 通信路径 | 协议 | 用途 |
|----------|------|------|
| 前端 → 后端 | HTTP REST | 获取历史数据、创建会话 |
| 前端 ↔ 后端 | WebSocket | 实时聊天、流式响应 |
| 后端 ↔ 插件 | WebSocket | Agent 消息转发 |
| 前端 → 后端 | WebSocket | 任务状态订阅 |

---

## 4. 目录结构

```
openclaw-dashboard/
├── apps/
│   ├── web/                              # 前端应用
│   │   ├── src/
│   │   │   ├── app/                      # Next.js App Router
│   │   │   │   ├── layout.tsx            # 根布局
│   │   │   │   ├── page.tsx              # 主页面
│   │   │   │   └── globals.css           # 全局样式
│   │   │   ├── components/               # React 组件
│   │   │   │   ├── layout/               # 布局组件
│   │   │   │   │   ├── Sidebar.tsx       # 侧边栏
│   │   │   │   │   └── MainContent.tsx   # 主内容区
│   │   │   │   ├── chat/                 # 聊天组件
│   │   │   │   │   ├── ChatPanel.tsx     # 聊天面板
│   │   │   │   │   ├── MessageList.tsx   # 消息列表
│   │   │   │   │   ├── MessageItem.tsx   # 消息项
│   │   │   │   │   ├── TaskCard.tsx      # 任务卡片
│   │   │   │   │   └── InputBar.tsx      # 输入框
│   │   │   │   ├── task/                 # 任务组件
│   │   │   │   │   └── TaskModal.tsx     # 任务详情模态框
│   │   │   │   └── common/               # 通用组件
│   │   │   ├── hooks/                    # 自定义 Hooks
│   │   │   │   ├── useWebSocket.ts       # WebSocket 连接
│   │   │   │   └── useChat.ts            # 聊天逻辑
│   │   │   ├── stores/                   # Zustand 状态
│   │   │   │   └── chatStore.ts          # 聊天状态
│   │   │   ├── lib/                      # 工具函数
│   │   │   │   └── api.ts                # HTTP API
│   │   │   └── types/                    # 类型定义
│   │   ├── .env.local                    # 环境变量
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── server/                           # 后端应用
│       ├── src/
│       │   ├── index.ts                  # 入口
│       │   ├── app.ts                    # Fastify 应用
│       │   ├── routes/                   # API 路由
│       │   │   ├── conversations.ts      # 会话路由
│       │   │   ├── messages.ts           # 消息路由
│       │   │   ├── tasks.ts              # 任务路由
│       │   │   └── websocket.ts          # WebSocket 路由
│       │   ├── services/                 # 业务服务
│       │   │   ├── messageParser.ts      # 消息解析器
│       │   │   └── taskManager.ts        # 任务管理器
│       │   ├── db/                       # 数据库
│       │   │   ├── index.ts              # 数据库连接
│       │   │   └── schema.sql            # 表结构
│       │   └── types/                    # 类型定义
│       ├── data/                         # 数据文件
│       │   └── dashboard.db              # SQLite 数据库
│       ├── .env                          # 环境变量
│       └── package.json
│
├── packages/
│   ├── shared/                           # 共享包
│   │   └── types/                        # 共享类型
│   │       └── index.ts
│   └── dashboard-plugin/                 # Openclaw 插件
│       ├── src/
│       │   ├── channel.ts                # Channel 定义
│       │   ├── gateway.ts                # WS 客户端
│       │   └── outbound.ts               # 消息发送
│       └── package.json
│
├── docs/                                 # 文档
│   ├── prd/                              # PRD 文档体系
│   └── plans/                            # 原始设计文档
│
├── package.json                          # Monorepo 根配置
├── pnpm-workspace.yaml                   # pnpm workspace
└── pnpm-lock.yaml
```

---

## 5. API 设计概要

### 5.1 REST API

**基础路径**: `/api/v1`

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/conversations` | 获取会话列表 |
| POST | `/conversations` | 创建新会话 |
| GET | `/conversations/:id` | 获取会话详情 |
| PUT | `/conversations/:id` | 更新会话（标题、置顶） |
| DELETE | `/conversations/:id` | 删除会话 |
| GET | `/conversations/:id/messages` | 获取会话消息 |
| GET | `/tasks/:id` | 获取任务详情 |
| POST | `/tasks/:id/cancel` | 取消任务 |

### 5.2 WebSocket 消息

**前端连接**: `ws://localhost:3001/ws`

| 类型 | 方向 | 描述 |
|------|------|------|
| `chat.send` | 前端 → 后端 | 发送消息 |
| `conversation.create` | 前端 → 后端 | 创建会话 |
| `conversation.switch` | 前端 → 后端 | 切换会话 |
| `task.cancel` | 前端 → 后端 | 取消任务 |
| `chat.message` | 后端 → 前端 | 新消息 |
| `chat.streaming` | 后端 → 前端 | 流式响应 |
| `task.created` | 后端 → 前端 | 任务创建 |
| `task.updated` | 后端 → 前端 | 任务更新 |

---

## 6. 核心模块设计

### 6.1 前端模块

#### Zustand Store (chatStore.ts)

```typescript
interface ChatState {
  // 会话
  conversations: Conversation[];
  currentConversationId: string | null;

  // 消息
  messages: Record<string, Message[]>;

  // 任务
  tasks: Record<string, Task>;

  // 流式状态
  streamingContent: string;
  isStreaming: boolean;

  // UI 状态
  sidebarOpen: boolean;
  taskModalTaskId: string | null;
}
```

#### WebSocket Hook (useWebSocket.ts)

- 管理 WebSocket 连接生命周期
- 处理消息发送和接收
- 实现断线重连机制
- 提供连接状态

### 6.2 后端模块

#### 消息解析器 (messageParser.ts)

- 解析任务协议标记
- 提取任务类型、标题、进度
- 分离纯净文本内容

#### 任务管理器 (taskManager.ts)

- 创建/更新/完成任务
- 维护活跃任务状态
- 推送任务状态更新

#### 连接管理器

- 管理前端 WebSocket 连接
- 管理插件 WebSocket 连接
- 消息路由和广播

---

## 7. 第三方集成

### 7.1 Openclaw Dashboard Plugin

| 组件 | 功能 |
|------|------|
| **Gateway** | 作为 WebSocket 客户端连接 Dashboard Backend |
| **Channel** | Openclaw Channel 插件定义 |
| **Outbound** | 发送消息到 Dashboard Backend |

### 7.2 集成配置

```yaml
# Openclaw 配置
channels:
  dashboard:
    enabled: true
    backendUrl: "http://your-dashboard-server:3001"
    pluginToken: "your-secure-token"
```

---

## 8. 安全设计

### 8.1 认证机制

| 场景 | 机制 | 说明 |
|------|------|------|
| 插件认证 | Token 验证 | X-Plugin-Token header |
| 前端访问 | 无认证 | 个人使用，内网访问 |

### 8.2 数据安全

- **数据库**：SQLite 本地存储，无网络暴露
- **通信**：生产环境使用 WSS/HTTPS
- **Token**：环境变量存储，不提交代码库

### 8.3 输入验证

- 使用 Zod 进行请求数据验证
- 防止 XSS：React 自动转义
- 防止注入：参数化 SQL 查询

---

## 9. 部署方案

### 9.1 环境配置

| 环境 | 变量 | 值 |
|------|------|-----|
| 后端 | PORT | 3001 |
| 后端 | HOST | 0.0.0.0 |
| 后端 | DB_PATH | ./data/dashboard.db |
| 后端 | PLUGIN_TOKEN | your-secure-token |
| 前端 | NEXT_PUBLIC_API_URL | http://localhost:3001/api/v1 |
| 前端 | NEXT_PUBLIC_WS_URL | ws://localhost:3001/ws |

### 9.2 端口分配

| 服务 | 端口 | 协议 |
|------|------|------|
| Frontend (Next.js) | 3000 | HTTP |
| Backend (Fastify) | 3001 | HTTP + WebSocket |

### 9.3 启动命令

```bash
# 开发环境
pnpm dev                  # 同时启动前后端
pnpm dev:web              # 仅启动前端
pnpm dev:server           # 仅启动后端

# 生产环境
pnpm build                # 构建前后端
pnpm start                # 启动服务（需分别启动）
```

### 9.4 部署架构

```
┌─────────────────────────────────────────┐
│              单机部署                    │
│  ┌─────────────────────────────────────┐│
│  │  Nginx (可选)                        ││
│  │  - 静态文件服务                       ││
│  │  - 反向代理到 Fastify                ││
│  └─────────────────────────────────────┘│
│                    │                     │
│  ┌─────────────────┼─────────────────┐  │
│  │                 ▼                  │  │
│  │  Next.js (3000)  Fastify (3001)   │  │
│  │                    │               │  │
│  │              SQLite DB            │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 更新记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-11 | 1.0 | 初始化技术架构文档，基于现有项目扫描生成 |
