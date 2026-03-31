# Openclaw Dashboard - 项目待办清单

> 基于 PRD v1.0 生成
> 最后更新：2026-03-30
> 当前进度: 迭代 3 / 共 3 个迭代

> **📋 执行计划**：[plan_迭代1.md](../plan/plan_迭代1.md) | [plan_迭代2.md](../plan/plan_迭代2.md) | [plan_迭代3.md](../plan/plan_迭代3.md)

---

## 迭代计划总览

| 迭代 | 目标 | 后端任务 | 前端任务 | 完成度 | 状态 |
|------|------|---------|---------|--------|------|
| 迭代 1 | 规则维护功能 | 4/4 | 6/6 | 12/12 | ✅ |
| 迭代 2 | 移除插件模式，启用 Gateway 直连 | 5/5 | 3/3 | 9/9 | ✅ |
| 迭代 3 | 远程连接功能 | 9/9 | 4/4 | 13/13 | ✅ |

---

## 迭代 1：规则维护功能 ✅

> 📋 对应 PRD 功能：会话初始化规则管理
> 📊 进度：12/12 任务完成
> ✅ 完成时间：2026-03-24

### 功能概述

构建规则维护系统，支持会话初始化规则的 CRUD 操作。规则是注入到 agent system prompt 中的模板文本，支持变量插值（如 `{{conversationId}}`）。参考现有 `buildFileSavedProtocol` 的实现方式。

### 后端任务

- [x] **BE-01 数据模型设计** - 创建 `rules` 表结构 ✅
  - 字段：id, name, description, template, variables (JSON), is_enabled, priority, created_at, updated_at
  - 文件：`apps/server/src/db/schema.sql`

- [x] **BE-02 数据库迁移** - 添加迁移脚本创建 rules 表 ✅
  - 文件：`apps/server/src/db/index.ts` 迁移逻辑

- [x] **BE-03 规则 API 接口** - 实现 `/api/v1/rules` CRUD ✅
  - GET /api/v1/rules - 获取规则列表（支持 enabled 过滤）
  - GET /api/v1/rules/:id - 获取单个规则
  - POST /api/v1/rules - 创建规则
  - PUT /api/v1/rules/:id - 更新规则
  - DELETE /api/v1/rules/:id - 删除规则
  - PATCH /api/v1/rules/:id/toggle - 启用/禁用规则
  - 文件：`apps/server/src/routes/rules.ts`

- [x] **BE-04 规则服务层** - 创建规则处理服务 ✅
  - 模板变量插值函数
  - 获取启用的规则并渲染
  - 文件：`apps/server/src/services/ruleService.ts`

### 前端任务

- [x] **FE-01 API 集成** - 添加规则 API 调用方法 ✅
  - 文件：`apps/web/src/lib/api.ts`

- [x] **FE-02 状态管理** - 创建规则 Zustand Store ✅
  - 文件：`apps/web/src/stores/ruleStore.ts`

- [x] **FE-03 页面路由** - 添加规则管理页面入口 ✅
  - 路由：`/settings/rules`
  - 导航：在 Sidebar 设置菜单添加入口

- [x] **FE-04 规则列表组件** - 实现规则列表展示 ✅
  - 文件：`apps/web/src/components/rules/RuleList.tsx`
  - 功能：列表展示、启用/禁用开关、删除操作

- [x] **FE-05 规则编辑弹窗** - 实现规则新增/编辑 ✅
  - 文件：`apps/web/src/components/rules/RuleModal.tsx`
  - 功能：表单验证、模板预览、变量提示

- [x] **FE-06 规则卡片组件** - 单条规则展示 ✅
  - 文件：`apps/web/src/components/rules/RuleCard.tsx`

### 集成任务

- [x] **INT-01 Orchestrator 集成** - 修改会话初始化逻辑 ✅
  - 在 `runViaGateway` 中加载启用的规则
  - 渲染模板变量并注入 systemPrompt
  - 文件：`apps/server/src/services/orchestrator.ts`

- [x] **INT-02 迁移现有规则** - 将硬编码规则迁移到数据库 ✅
  - 迁移 `buildFileSavedProtocol` 为种子数据
  - 添加到数据库初始化脚本

---

## 数据模型参考

### Rule 实体

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID，前缀 `rule_` |
| name | TEXT | NOT NULL | 规则名称 |
| description | TEXT | - | 规则描述 |
| template | TEXT | NOT NULL | 规则模板（支持 `{{var}}` 变量） |
| variables | TEXT | - | JSON 定义变量，如 `["conversationId"]` |
| is_enabled | INTEGER | DEFAULT 1 | 是否启用 (0/1) |
| priority | INTEGER | DEFAULT 0 | 优先级（越大越先注入） |
| created_at | DATETIME | - | 创建时间 |
| updated_at | DATETIME | - | 更新时间 |

### 模板变量

| 变量 | 说明 | 来源 |
|------|------|------|
| `{{conversationId}}` | 当前会话 ID | orchestrator |
| `{{workDir}}` | 会话工作目录 | orchestrator |
| `{{cwd}}` | 服务器当前目录 | process.cwd() |

---

## 迭代 2：移除插件模式，启用 Gateway 直连 ✅

> 📋 目标：移除 dashboard-plugin 包和插件连接模式，统一使用 Gateway 直连作为唯一 AI 后端连接方式
> 📊 进度：9/9 任务完成
> ✅ 完成时间：2026-03-30

### 功能概述

当前系统支持两种 AI 后端连接方式：Gateway 直连和 Plugin 插件模式。插件模式需要将 dashboard-plugin 安装到 Openclaw 中，增加了部署复杂度。本次迭代移除插件模式，简化架构，统一使用 Gateway 直连。

### 后端任务

- [x] **BE-01 删除插件包** - 删除 `packages/dashboard-plugin/` 整个目录 ✅
  - 包括 `src/`、`package/`、`openclaw.plugin.json`、`.tgz` 文件
  - 删除后重新执行 `pnpm install` 更新 lockfile

- [x] **BE-02 删除插件服务代码** - 移除 `pluginManager` 和插件路由 ✅
  - 删除 `apps/server/src/services/pluginManager.ts`
  - 删除 `apps/server/src/routes/plugin.ts`

- [x] **BE-03 清理 websocket.ts** - 移除插件 fallback 逻辑 ✅
  - 移除 `pluginManager` 导入
  - 移除 `setupPluginMessageHandlers()` 函数（处理 plugin.auth、agent.message 等事件）
  - 移除 `handleChatSend` 中的插件 fallback 分支（lines 279-312）
  - Gateway 不可用时直接返回错误，不再 fallback
  - 更新错误提示消息

- [x] **BE-04 清理 app.ts** - 移除插件路由注册和调试端点 ✅
  - 移除 `pluginRoutes` 和 `pluginManager` 导入
  - 移除 `/ws/plugin` 路由注册
  - 移除 `GET /api/debug/plugins` 调试端点
  - 移除 `POST /api/debug/test-plugin` 调试端点
  - 移除启动横幅中的 `Plugin WS` 行

- [x] **BE-05 清理配置和入口** - 移除插件相关配置 ✅
  - `apps/server/src/config.ts`：移除 `plugin` 字段和 `PLUGIN_TOKEN` 读取
  - `apps/server/src/index.ts`：移除 `plugin` 配置
  - `apps/server/src/services/orchestrator.ts`：更新日志消息，移除 "plugin mode" 引用
  - `apps/server/.env.example`：移除 `PLUGIN_TOKEN`
  - `.env`：取消注释 `OPENCLAW_GATEWAY_URL` 和 `OPENCLAW_GATEWAY_TOKEN`

### 清理任务

- [x] **CLN-01 清理共享类型** - 移除插件相关 WebSocket 类型 ✅
  - `packages/shared/types/src/index.ts`：移除 `WSPluginAuthPayload`、`WSUserMessagePayload`、`WSAgentMessagePayload`、`WSAgentStreamingPayload`、`WSAgentMediaPayload` 等类型

- [x] **CLN-02 清理 README** - 移除插件相关文档段落 ✅
  - 移除插件安装、配置、使用说明相关段落

- [x] **CLN-03 更新设计文档** - 同步设计文档 ✅
  - `docs/prd/02_TECH.md`：移除插件相关架构描述（共享包、路由、服务、认证等）
  - `docs/prd/00_PRD_GRAPH.md`：目录结构中移除 `dashboard-plugin`

### 验证任务

- [x] **VRF-01 端到端验证** - 编译通过、零残留引用 ✅
  - 执行 `pnpm install` 确认依赖正确
  - TypeScript 编译无错误
  - 无 pluginManager/pluginRoutes/PLUGIN_TOKEN 残留引用

---

## 迭代 3：远程连接功能 ✅

> 📋 目标：Dashboard 与远程 OpenClaw Gateway 分离部署，通过 SSH 隧道 + JSON-RPC 连接远程服务器
> 📊 进度：13/13 任务完成
> ✅ 完成时间：2026-03-30
> 📄 设计文档：[远程连接设计文档](../superpowers/specs/2025-03-26-remote-connection-design.md)

### 功能概述

实现 Dashboard 与 OpenClaw Gateway 的分离部署能力。Dashboard Server 通过 SSH 隧道连接远程服务器上运行的 `dashboard-remote-server` sidecar 服务，实现多服务器管理、远程文件浏览、远程 Agent 交互。

**前置基础（已完成）：**
- 前端 UI 组件：`ServerManager`、`ServerForm`、`FileExplorer`、`FilePreview`（4 个组件）
- 前端 Store：`remoteStore`、`fileStore`
- 前端集成：Sidebar 服务器分组、ArtifactsPanel Tab 切换
- `dashboard-remote-server` 包主体（在 worktree 中，JSON-RPC 服务器 + 文件系统 + 文件监控）

### 数据与类型任务

- [x] **DB-01 数据库变更** - 添加远程服务器表和会话关联 ✅
  - 新增 `remote_servers` 表：id, name, host, port, username, private_key_path, remote_port, created_at, updated_at
  - `conversations` 表添加 `server_id` 列（TEXT，可空，null 为本地）
  - 文件：`apps/server/src/db/schema.sql`、`apps/server/src/db/index.ts`

- [x] **DB-02 共享类型定义** - 在 shared 包添加远程连接类型 ✅
  - `RemoteServerInfo`、`RemoteServerStatus`、`FileInfo`、`FileContent`
  - 远程相关 WebSocket 消息类型（`remote.servers`、`directory:list`、`file:read` 等）
  - 文件：`packages/shared/types/src/index.ts`

### dashboard-remote-server 包集成任务

- [x] **PKG-01 合并 remote-server 包** - 从 worktree 合并到主仓库 ✅
  - 将 `.worktrees/remote-connection/packages/dashboard-remote-server/` 合并到 `packages/dashboard-remote-server/`
  - 添加到 `pnpm-workspace.yaml`
  - 执行 `pnpm install` 更新依赖
  - 编译验证通过

- [x] **PKG-02 接入 Gateway 桥接** - 将 Gateway 模块接入 JSON-RPC 方法 ✅
  - `gatewayBridge` 模块已存在但未接入 `jsonRpcServer.ts` 的方法注册
  - 实现 `gateway.runAgent`、`gateway.getStatus`、`gateway.listAgents` 方法
  - 转发 Gateway 事件到 JSON-RPC 客户端
  - 文件：`packages/dashboard-remote-server/src/server/jsonRpcServer.ts`、`src/modules/gatewayBridge.ts`### Dashboard Server 后端任务

- [x] **BE-01 SSH 隧道管理器** - 实现隧道建立/关闭/状态追踪 ✅
  - 使用 `ssh2` 库建立 SSH 隧道
  - 每个远程服务器分配本地端口（13001+）
  - 隧道状态管理：connecting → connected / error
  - 断线自动重连
  - 文件：`apps/server/src/remote/sshTunnel.ts`

- [x] **BE-02 JSON-RPC 客户端** - 连接远程 remote-server ✅
  - 通过 SSH 隧道本地端口连接远程 WebSocket
  - 实现 JSON-RPC 2.0 协议通信
  - 封装文件操作和 Gateway 调用方法
  - 事件监听：文件变更、Gateway 事件
  - 文件：`apps/server/src/remote/client.ts`

- [x] **BE-03 远程连接管理器** - 编排隧道、客户端、服务器切换 ✅
  - 管理多个远程服务器连接生命周期
  - 活跃服务器切换（activeServerId）
  - 连接/断开/状态查询
  - 文件：`apps/server/src/remote/manager.ts`、`apps/server/src/remote/index.ts`

- [ ] **BE-04 REST API 路由** - 远程服务器 CRUD + 连接管理
  - GET /api/v1/remote/servers - 获取所有服务器状态
  - POST /api/v1/remote/servers - 添加服务器配置
  - PUT /api/v1/remote/servers/:id - 更新服务器配置
  - DELETE /api/v1/remote/servers/:id - 删除服务器配置
  - POST /api/v1/remote/servers/:id/connect - 连接服务器
  - POST /api/v1/remote/servers/:id/disconnect - 断开服务器
  - PUT /api/v1/remote/active - 切换当前活跃服务器
  - 文件：`apps/server/src/routes/remote.ts`

- [ ] **BE-05 WebSocket 消息处理** - 远程相关消息的服务端处理
  - `remote.servers` → 查询数据库返回服务器列表
  - `remote.switch` → 切换活跃服务器
  - `directory:list` → 代理到远程 JSON-RPC 客户端
  - `file:read` → 代理到远程 JSON-RPC 客户端
  - `watch.subscribe/unsubscribe` → 代理文件监控
  - 文件：`apps/server/src/routes/websocket.ts`

### 集成任务

- [ ] **INT-01 Orchestrator 远程模式** - 消息路由支持远程服务器
  - `handleUserMessage` 判断当前会话的 serverId
  - 有 serverId → 通过远程 JSON-RPC 客户端发送
  - 无 serverId → 使用本地 Gateway（现有逻辑）
  - 文件：`apps/server/src/services/orchestrator.ts`

- [ ] **INT-02 会话-服务器关联** - 创建会话时绑定服务器
  - `createConversation` 支持传入 serverId
  - 前端 Sidebar 中服务器分组的 [+新] 按钮传递 serverId
  - WebSocket 的 `conversation.create` 消息携带 serverId
  - 文件：`apps/server/src/routes/websocket.ts`、`apps/web/src/components/layout/Sidebar.tsx`

- [ ] **INT-03 前端 WebSocket 补全** - 对接后端新增消息
  - `connectServer`/`disconnectServer` 改用 WebSocket 消息（或保持 REST + WS 状态同步）
  - 处理 `remote.server.status` 推送的状态更新
  - 文件：`apps/web/src/hooks/useWebSocket.ts`、`apps/web/src/stores/remoteStore.ts`

### 验证任务

- [ ] **VRF-01 端到端验证** - 编译通过 + 远程连接流程
  - TypeScript 全栈编译无错误
  - Dashboard Server 启动无报错
  - dashboard-remote-server 独立启动正常
  - REST API CRUD 功能验证
  - WebSocket 消息收发验证

---

## 更新记录

| 日期 | 变更内容 |
|------|----------|
| 2026-03-30 | 新增迭代 3：远程连接功能 |
| 2026-03-30 | 新增迭代 2：移除插件模式，启用 Gateway 直连 |
| 2026-03-23 | 初始化：创建迭代 1 规则维护功能 |
