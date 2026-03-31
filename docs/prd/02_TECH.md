# Openclaw Dashboard - 技术架构设计

*版本：1.0 | 状态：已实现 | 更新时间：2026-03-21*

---

## 1. 技术概述

### 1.1 技术目标

- **高性能实时通信** - 基于 WebSocket 的低延迟双向通信
- **类型安全** - 全栈 TypeScript，运行时 Zod 校验
- **开发效率** - Monorepo 统一管理，热重载开发体验
- **轻量部署** - 无外部依赖，单机可运行

### 1.2 架构风格

| 层级 | 架构模式 | 说明 |
|------|----------|------|
| **整体架构** | Monorepo | 多包统一管理，共享类型定义 |
| **前端架构** | 组件化 + 状态管理 | React 组件 + Zustand 全局状态 |
| **后端架构** | 分层架构 | Routes → Services → Storage |
| **通信架构** | 双通道 | REST API + WebSocket 实时通信 |

### 1.3 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **前端框架** | Next.js | SSR/SSG 支持，文件系统路由，开发体验好 |
| **后端框架** | Fastify | 高性能，原生 WebSocket 支持，插件生态 |
| **数据库** | SQLite (sql.js) | 轻量级，零配置，适合单机部署 |
| **状态管理** | Zustand | 轻量，简单 API，TypeScript 友好 |
| **样式方案** | Tailwind CSS | 原子化 CSS，开发效率高，无需写 CSS 文件 |
| **类型校验** | Zod | 运行时校验，与 TypeScript 完美配合 |

---

## 2. 技术栈选择

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | Next.js | ^14.1.0 | React 框架，支持 SSR/SSG |
| **UI 库** | React | ^18.2.0 | 组件化 UI 开发 |
| **状态管理** | Zustand | ^4.5.0 | 轻量级全局状态管理 |
| **样式** | Tailwind CSS | ^3.4.0 | 原子化 CSS 框架 |
| **图标** | Lucide React | ^0.314.0 | 图标库 |
| **工具库** | clsx, tailwind-merge | ^2.1.0, ^2.2.0 | 类名合并工具 |
| **测试** | Vitest | ^4.0.18 | 单元测试框架 |
| **类型** | TypeScript | ^5.3.0 | 类型安全 |

### 2.2 后端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | Fastify | ^4.26.0 | 高性能 Web 框架 |
| **WebSocket** | ws, @fastify/websocket | ^8.16.0, ^10.0.0 | 实时通信 |
| **数据库** | sql.js | ^1.10.0 | SQLite 的 JavaScript 实现 |
| **校验** | Zod | ^3.22.0 | 运行时类型校验 |
| **CORS** | @fastify/cors | ^9.0.0 | 跨域支持 |
| **工具** | uuid, dotenv | ^9.0.0, ^17.3.1 | UUID 生成，环境变量 |
| **类型** | TypeScript | ^5.3.0 | 类型安全 |
| **运行时** | tsx | ^4.7.0 | TypeScript 执行器 |

### 2.3 共享包

| 包名 | 用途 |
|------|------|
| `@openclaw-dashboard/shared` | 前后端共享类型定义 |
| `@openclaw-dashboard/dashboard-remote-server` | 远程服务器 sidecar，桥接 Gateway 和文件系统 |

### 2.4 开发工具

| 工具 | 用途 |
|------|------|
| **pnpm** | 包管理器，Monorepo 支持 |
| **Node.js** | 运行环境 (≥18.0.0) |

---

## 3. 系统架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Frontend (Next.js 14)                         │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │    │
│  │  │  Sidebar  │ │MainContent│ │Artifacts  │ │ Settings Pages│   │    │
│  │  │           │ │           │ │  Panel    │ │               │   │    │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────────────┘   │    │
│  │        │             │             │                           │    │
│  │        └─────────────┼─────────────┘                           │    │
│  │                      │                                         │    │
│  │  ┌───────────────────▼───────────────────┐                    │    │
│  │  │          Zustand Store                 │                    │    │
│  │  │  - conversations  - messages  - tasks │                    │    │
│  │  │  - experts  - automations  - artifacts│                    │    │
│  │  └───────────────────┬───────────────────┘                    │    │
│  │                      │                                         │    │
│  │  ┌───────────────────▼───────────────────┐                    │    │
│  │  │         useWebSocket Hook              │                    │    │
│  │  │  - 连接管理  - 消息收发  - 事件处理    │                    │    │
│  │  └───────────────────┬───────────────────┘                    │    │
│  └──────────────────────┼────────────────────────────────────────┘    │
└─────────────────────────┼─────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
     WebSocket (ws)              REST API (HTTP)
     ws://localhost:3002         http://localhost:3002/api/v1
            │                           │
┌───────────┴───────────────────────────┴─────────────────────────────────┐
│                     Backend (Fastify 4)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Routes Layer                              │    │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐                 │    │
│  │  │ /ws        │ │ /api/v1/   │ │ Static Files │                 │    │
│  │  │ WebSocket  │ │ REST API   │ │              │                 │    │
│  │  └─────┬──────┘ └─────┬──────┘ └──────────────┘                 │    │
│  └────────┼──────────────┼────────────────────────────────────────┘    │
│           │              │                                             │
│  ┌────────▼──────────────▼─────────────────────────────────────────┐    │
│  │                     Services Layer                               │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐ │    │
│  │  │ Orchestrator │ │ TaskManager  │ │ ArtifactStorage        │ │    │
│  │  │ - 消息路由   │ │ - 任务管理   │ │ - 文件存储             │ │    │
│  │  │ - Agent 选择 │ │ - 状态追踪   │ │ - 元数据管理           │ │    │
│  │  └──────────────┘ └──────────────┘ └────────────────────────┘ │    │
│  │  ┌──────────────┐ ┌────────────────────────────────────────┐ │    │
│  │  │MessageParser │ │OpenclawGatewayClient                   │ │    │
│  │  │- 协议解析    │ │- Gateway 连接                          │ │    │
│  │  │- 提取处理    │ │- 事件流处理                            │ │    │
│  │  └──────────────┘ └────────────────────────────────────────┘ │    │
│  └───────────────────────────────────────────────────────────────┘    │
│           │                              │                             │
│  ┌────────▼──────────────────────────────▼─────────────────────────┐  │
│  │                     Storage Layer                                │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │    SQLite (sql.js)      │  │      File System            │  │  │
│  │  │  - conversations        │  │  - artifacts/               │  │  │
│  │  │  - messages             │  │    └── {conversation_id}/   │  │  │
│  │  │  - tasks                │  │        └── {artifact_file}  │  │  │
│  │  │  - experts              │  │                             │  │  │
│  │  │  - categories           │  │                             │  │  │
│  │  │  - automations          │  │                             │  │  │
│  │  │  - artifacts            │  │                             │  │  │
│  │  │  - rules                │  │                             │  │  │
│  │  └─────────────────────────┘  └─────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
           │
           │ WebSocket (Gateway Protocol)
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Openclaw Gateway (External)                          │
│  - Agent 通信                                                            │
│  - 事件流                                                                │
│  - Run 管理                                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1a 远程连接架构

```
┌─────────────────────────────────────────────────────────────┐
│                    远程连接架构                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Dashboard Server                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Remote Connection Manager                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │SSH Tunnel│  │SSH Tunnel│  │JSON-RPC  │              │  │
│  │  │ Server-B │  │ Server-C │  │ Client   │              │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘              │  │
│  └───────┼──────────────┼─────────────┼───────────────────┘  │
└──────────┼──────────────┼─────────────┼──────────────────────┘
           │ SSH          │             │ WebSocket
           ▼              ▼             ▼
  ┌─────────────┐  ┌─────────────┐
  │ Server B     │  │ Server C     │
  │ remote-server│  │ remote-server│
  │ + Gateway    │  │ + Gateway    │
  └─────────────┘  └─────────────┘
```

### 3.2 核心组件

| 组件 | 位置 | 职责 |
|------|------|------|
| **Orchestrator** | server/services | 消息路由、Agent 选择、交接逻辑 |
| **TaskManager** | server/services | 任务生命周期管理、输出管理 |
| **ArtifactStorage** | server/services | 文件存储、元数据管理 |
| **MessageParser** | server/services | 任务协议解析、代码块提取 |
| **OpenclawGatewayClient** | server/services | Gateway 连接、事件流处理 |
| **RuleService** | server/services | 规则模板管理、变量插值、渲染 |
| **chatStore** | web/stores | 前端全局状态管理 |
| **useWebSocket** | web/hooks | WebSocket 连接管理 |
| **RemoteConnectionManager** | server/remote | SSH 隧道、JSON-RPC 客户端、服务器切换 |
| **dashboard-remote-server** | packages/ | 远程 sidecar，Gateway 桥接、文件系统 |

### 3.3 通信方式

| 通信类型 | 协议 | 用途 |
|----------|------|------|
| **实时通信** | WebSocket | 聊天、任务更新、流式响应 |
| **数据操作** | REST API | CRUD 操作（会话、专家、自动化、产物） |
| **Gateway 通信** | WebSocket | Agent 交互、事件流 |
| **远程通信** | WebSocket + JSON-RPC | SSH 隧道到远程 dashboard-remote-server |

---

## 4. 目录结构

```
openclaw-dashboard/
├── apps/
│   ├── web/                           # Next.js 前端应用
│   │   ├── src/
│   │   │   ├── app/                   # App Router 页面
│   │   │   │   ├── page.tsx           # 主页面 (/)
│   │   │   │   ├── layout.tsx         # 根布局
│   │   │   │   └── settings/
│   │   │   │       └── categories/
│   │   │   │           └── page.tsx   # 分类管理页
│   │   │   │
│   │   │   ├── components/            # UI 组件
│   │   │   │   ├── chat/              # 聊天组件
│   │   │   │   │   ├── ChatPanel.tsx
│   │   │   │   │   ├── MessageList.tsx
│   │   │   │   │   ├── MessageItem.tsx
│   │   │   │   │   ├── InputBar.tsx
│   │   │   │   │   ├── RoleSelector.tsx
│   │   │   │   │   └── TaskCard.tsx
│   │   │   │   │
│   │   │   │   ├── expert/            # 专家组件
│   │   │   │   │   ├── ExpertCenter.tsx
│   │   │   │   │   ├── ExpertCard.tsx
│   │   │   │   │   ├── ExpertForm.tsx
│   │   │   │   │   └── ExpertModal.tsx
│   │   │   │   │
│   │   │   │   ├── automation/        # 自动化组件
│   │   │   │   │   ├── AutomationCenter.tsx
│   │   │   │   │   ├── AutomationItem.tsx
│   │   │   │   │   └── AutomationModal.tsx
│   │   │   │   │
│   │   │   │   ├── category/          # 分类组件
│   │   │   │   │   ├── CategoryList.tsx
│   │   │   │   │   ├── CategoryForm.tsx
│   │   │   │   │   └── CategoryModal.tsx
│   │   │   │   │
│   │   │   │   ├── task/              # 任务组件
│   │   │   │   │   └── TaskModal.tsx
│   │   │   │   │
│   │   │   │   └── layout/            # 布局组件
│   │   │   │       ├── Sidebar.tsx
│   │   │   │       ├── MainContent.tsx
│   │   │   │       └── ArtifactsPanel.tsx
│   │   │   │
│   │   │   ├── hooks/                 # 自定义 Hooks
│   │   │   │   └── useWebSocket.ts
│   │   │   │
│   │   │   ├── stores/                # Zustand 状态管理
│   │   │   │   └── chatStore.ts
│   │   │   │
│   │   │   └── lib/                   # 工具库
│   │   │       ├── api.ts
│   │   │       └── utils.ts
│   │   │
│   │   ├── public/                    # 静态资源
│   │   ├── package.json
│   │   ├── tailwind.config.js
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   └── server/                        # Fastify 后端应用
│       ├── src/
│       │   ├── index.ts               # 入口文件
│       │   ├── app.ts                 # Fastify 应用配置
│       │   ├── config.ts              # 配置管理
│       │   │
│       │   ├── routes/                # API 路由
│       │   │   ├── websocket.ts       # 前端 WebSocket
│       │   │   ├── conversations.ts   # 会话 CRUD
│       │   │   ├── messages.ts        # 消息 CRUD
│       │   │   ├── tasks.ts           # 任务 CRUD
│       │   │   ├── experts.ts         # 专家 CRUD
│       │   │   ├── categories.ts      # 分类 CRUD
│       │   │   ├── automations.ts     # 自动化 CRUD
│       │   │   └── artifacts.ts       # 产物 CRUD
│       │   │
│       │   ├── services/              # 业务服务
│       │   │   ├── orchestrator.ts    # 编排服务
│       │   │   ├── taskManager.ts     # 任务管理
│       │   │   ├── artifactStorage.ts # 产物存储
│       │   │   ├── messageParser.ts   # 消息解析
│       │   │   ├── openclawGatewayClient.ts
│       │   │   ├── virtualAgents.ts   # 虚拟 Agent
│       │   │   └── handoffParser.ts   # 交接解析
│       │   │
│       │   └── db/                    # 数据库
│       │       ├── index.ts           # 数据库初始化
│       │       └── schema.sql         # 表结构
│       │
│       ├── data/                      # 数据目录
│       │   ├── dashboard.db           # SQLite 数据库
│       │   └── conversations/         # 产物文件存储
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                        # 共享类型包
│       └── types/
│           ├── src/index.ts           # 类型定义
│           └── package.json
│
├── docs/
│   └── prd/                           # 设计文档
│       ├── 00_PRD_GRAPH.md
│       ├── 01_PRD.md
│       ├── 02_TECH.md
│       ├── 03_DATAMODEL.md
│       ├── 04_UX_DESIGN.md
│       └── 05_API.md
│
├── .env                               # 环境变量
├── package.json                       # Monorepo 根配置
├── pnpm-workspace.yaml               # pnpm 工作区配置
└── CLAUDE.md                          # 项目规范
```

---

## 5. API 设计概要

### 5.1 REST API 端点

| 前缀 | 端点 | 方法 | 功能 |
|------|------|------|------|
| `/api/v1` | `/conversations` | GET, POST | 会话列表、创建 |
| | `/conversations/:id` | GET, PUT, DELETE | 会话详情、更新、删除 |
| | `/messages` | GET, POST | 消息列表、创建 |
| | `/tasks` | GET | 任务列表 |
| | `/tasks/:id` | GET | 任务详情 |
| | `/experts` | GET, POST | 专家列表、创建 |
| | `/experts/:id` | GET, PUT, DELETE | 专家详情、更新、删除 |
| | `/categories` | GET, POST | 分类列表、创建 |
| | `/categories/:id` | PUT, DELETE | 分类更新、删除 |
| | `/automations` | GET, POST | 自动化列表、创建 |
| | `/automations/:id` | GET, PUT, DELETE | 自动化详情、更新、删除 |
| | `/automations/:id/trigger` | POST | 手动触发 |
| | `/artifacts` | GET | 产物列表 |
| | `/artifacts/:id` | GET | 产物详情（含内容） |
| | `/artifacts/:id/download` | GET | 下载产物文件 |

### 5.2 WebSocket 消息类型

**前端 → 服务器**

| 类型 | 功能 |
|------|------|
| `ping` | 心跳 |
| `conversation.create` | 创建会话 |
| `conversation.switch` | 切换会话 |
| `conversation.rename` | 重命名会话 |
| `conversation.togglePin` | 置顶/取消置顶 |
| `conversation.delete` | 删除会话 |
| `chat.send` | 发送消息 |
| `task.cancel` | 取消任务 |
| `history.load` | 加载历史 |
| `agents.list` | 获取 Agent 列表 |
| `artifacts.load` | 加载产物列表 |

**服务器 → 前端**

| 类型 | 功能 |
|------|------|
| `connected` | 连接确认 |
| `conversation.created/updated/deleted` | 会话变更通知 |
| `history.conversations/messages` | 历史数据 |
| `chat.message` | 新消息 |
| `chat.streaming` | 流式响应 |
| `task.created/updated/completed/failed` | 任务状态变更 |
| `task.output` | 任务输出 |
| `agents.list` | Agent 列表 |
| `agent.active/handoff` | Agent 激活/交接 |
| `artifact.created/deleted` | 产物变更通知 |
| `artifacts.list` | 产物列表 |
| `error` | 错误消息 |

---

## 6. 核心模块设计

### 6.1 Orchestrator（编排服务）

```
┌─────────────────────────────────────────────────────────┐
│                     Orchestrator                         │
├─────────────────────────────────────────────────────────┤
│ 职责：                                                   │
│ - 接收前端消息，路由到正确的处理流程                     │
│ - 选择合适的 Agent 处理请求                              │
│ - 处理 Agent 交接逻辑                                    │
│ - 注入文件保存协议到系统提示                             │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                  消息处理流程                            │
│                                                          │
│  用户消息 → Agent 选择 → Gateway 发送 → 响应处理        │
│                              │                           │
│                              ▼                           │
│                    MessageParser                         │
│                    - 任务协议解析                        │
│                    - 代码块提取                          │
│                    - 文件保存标记解析                    │
└─────────────────────────────────────────────────────────┘
```

### 6.2 TaskManager（任务管理器）

```
┌─────────────────────────────────────────────────────────┐
│                     TaskManager                          │
├─────────────────────────────────────────────────────────┤
│ 状态机：                                                 │
│                                                          │
│   ┌─────────┐    START    ┌─────────┐                  │
│   │  idle   │ ──────────► │ running │                  │
│   └─────────┘             └────┬────┘                  │
│                               │                         │
│              ┌────────────────┼────────────────┐       │
│              ▼                ▼                ▼       │
│        ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│        │completed │    │ failed   │    │ cancelled│   │
│        └──────────┘    └──────────┘    └──────────┘   │
│                                                          │
│ 协议标记：                                               │
│ - TASK:START:{title}     → 创建任务                     │
│ - TASK:PROGRESS:{msg}    → 更新进度                     │
│ - TASK:DONE              → 完成任务                     │
│ - TASK:FAILED:{error}    → 任务失败                     │
└─────────────────────────────────────────────────────────┘
```

### 6.3 RuleService（规则服务）

```
┌─────────────────────────────────────────────────────────┐
│                     RuleService                          │
├─────────────────────────────────────────────────────────┤
│ 职责：                                                   │
│ - 管理会话初始化规则（CRUD）                             │
│ - 渲染规则模板（变量插值）                               │
│ - 获取启用的规则并按优先级排序                           │
│ - 为 Orchestrator 提供渲染后的规则文本                   │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                   模板变量插值                           │
│                                                          │
│  模板：                                                  │
│  "你的工作目录是: {{workDir}}/"                         │
│                                                          │
│  变量：                                                  │
│  { workDir: "/data/conversations/conv_xxx" }            │
│                                                          │
│  渲染结果：                                              │
│  "你的工作目录是: /data/conversations/conv_xxx/"        │
└─────────────────────────────────────────────────────────┘
```

### 6.4 前端状态管理（chatStore）

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Store                         │
├─────────────────────────────────────────────────────────┤
│ 状态分区：                                               │
│                                                          │
│ conversations: Map<id, Conversation>                    │
│ messages: Map<conversationId, Message[]>                │
│ tasks: Map<id, Task>                                    │
│ experts: Expert[]                                       │
│ categories: Category[]                                  │
│ automations: Automation[]                               │
│ artifacts: Artifact[]                                   │
│                                                          │
│ UI 状态：                                                │
│ currentConversationId: string | null                    │
│ currentView: 'chat' | 'experts' | 'automations'         │
│ sidebarCollapsed: boolean                               │
│ artifactsPanelOpen: boolean                             │
│ streamingContent: Map<messageId, string>                │
│ activeAgent: AgentInfo | null                           │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 第三方集成

### 7.1 Openclaw Gateway

| 配置项 | 环境变量 | 说明 |
|--------|----------|------|
| URL | `OPENCLAW_GATEWAY_URL` | Gateway WebSocket 地址 |
| Token | `OPENCLAW_GATEWAY_TOKEN` | 认证令牌 |
| 重连间隔 | `OPENCLAW_GATEWAY_RECONNECT_INTERVAL` | 默认 5000ms |
| 连接超时 | `OPENCLAW_GATEWAY_CONNECTION_TIMEOUT` | 默认 30000ms |

### 7.2 连接架构

```
┌─────────────────────────────────────────────────────────┐
│                    连接架构                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    WebSocket     ┌─────────┐              │
│  │Dashboard│ ◄──────────────► │ Gateway │              │
│  └─────────┘                  └─────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 8. 安全设计

### 8.1 认证机制

| 组件 | 认证方式 | 说明 |
|------|----------|------|
| **前端 WebSocket** | 无认证 | 本地部署，信任本地连接 |
| **Gateway 连接** | Token 认证 | `OPENCLAW_GATEWAY_TOKEN` |

### 8.2 数据安全

| 措施 | 说明 |
|------|------|
| **本地存储** | SQLite 数据库存储在本地，不传输到外部 |
| **敏感配置** | 通过环境变量配置，不入代码库 |
| **Token 保护** | Gateway Token 仅存储在 .env 文件 |

### 8.3 CORS 配置

```typescript
// 允许的来源
cors: {
  origin: ['http://localhost:3000'],  // 前端开发服务器
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}
```

---

## 9. 部署方案

### 9.1 环境配置

| 环境 | 配置文件 | 说明 |
|------|----------|------|
| **开发环境** | `.env` | 本地开发配置 |
| **生产环境** | `.env.production` | 生产环境配置（需创建） |

### 9.2 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| **Web (开发)** | 3000 | Next.js 开发服务器 |
| **Server** | 3002 | Fastify API + WebSocket |
| **Gateway** | 18789 | Openclaw Gateway（外部） |

### 9.3 部署流程

**开发环境**

```bash
# 安装依赖
pnpm install

# 启动开发服务器（并行启动 web 和 server）
pnpm dev

# 或单独启动
pnpm dev:web      # 启动前端 (端口 3000)
pnpm dev:server   # 启动后端 (端口 3002)
```

**生产环境**

```bash
# 构建
pnpm build:web     # 构建前端
pnpm build:server  # 构建后端

# 启动
pnpm --filter @openclaw-dashboard/web start    # 启动前端
pnpm --filter @openclaw-dashboard/server start # 启动后端
```

### 9.4 数据目录

```
apps/server/data/
├── dashboard.db           # SQLite 数据库
└── conversations/         # 产物文件存储
    ├── {conversation_id}/
    │   ├── code_*.py
    │   ├── code_*.js
    │   └── image_*.png
    └── ...
```

---

## 10. 性能考量

### 10.1 前端优化

| 优化项 | 实现方式 |
|--------|----------|
| **乐观更新** | 消息先本地显示，后确认 |
| **虚拟列表** | 消息列表按需渲染（待优化） |
| **流式响应** | 逐字显示，无需等待完整响应 |
| **状态局部更新** | Zustand 选择器避免不必要的重渲染 |

### 10.2 后端优化

| 优化项 | 实现方式 |
|--------|----------|
| **同步数据库** | sql.js 同步 API，避免回调开销 |
| **WebSocket 复用** | 单一连接处理所有通信 |
| **内存缓存** | 连接状态内存管理 |

### 10.3 性能指标

| 指标 | 目标值 |
|------|--------|
| 消息延迟 | < 100ms |
| WebSocket 重连时间 | < 3s |
| 任务状态更新延迟 | < 200ms |

---

## 更新记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-30 | 1.2 | 新增远程连接架构描述 |
| 2026-03-23 | 1.1 | 新增 RuleService 规则系统架构 |
| 2026-03-21 | 1.0 | 基于现有代码逆向生成技术架构文档 |
