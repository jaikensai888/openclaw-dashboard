# 迭代 3 执行计划：远程连接功能

*基于 TODOLIST 生成，包含完整的 Plan-Do-Check 执行方案*
*代码示例：[snippets/迭代3/](snippets/迭代3/)*
*设计文档：[远程连接设计文档](../../superpowers/specs/2025-03-26-remote-connection-design.md)*

---

## 0. 修改记录（CHANGELOG）

| 版本 | 日期 | 修改类型 | 修改内容摘要 | 修改人/来源 | 状态 |
|------|------|---------|-------------|------------|------|
| 1.0.0 | 2026-03-30 | 初始创建 | 基于 TODOLIST 生成初始计划 | Claude | ✅ 已确认 |

---

## 1. Plan（计划）

### 1.1 迭代目标

**目标描述：** Dashboard 与远程 OpenClaw Gateway 分离部署，通过 SSH 隧道 + JSON-RPC 连接远程服务器。Dashboard Server 作为中继，前端 UI 完成服务器管理、文件浏览、远程 Agent 交互。

**前置基础（已完成）：**
- 前端 UI 组件：`ServerManager`、`ServerForm`、`FileExplorer`、`FilePreview`（4 个组件）✅
- 前端 Store：`remoteStore`、`fileStore` ✅
- 前端集成：Sidebar 服务器分组、ArtifactsPanel Tab 切换 ✅
- 前端 WebSocket：`useWebSocket` 中 remote 消息处理器 ✅
- `dashboard-remote-server` 包主体（在 worktree 中）✅
- Dashboard Server `remote/` 模块（在 worktree 中）✅

**交付物清单：**
- [ ] `remote_servers` 数据库表 + `conversations.server_id` 列
- [ ] 共享类型包中的远程连接类型定义
- [ ] `packages/dashboard-remote-server/` 合并到主仓库并编译通过
- [ ] Gateway 桥接方法接入 JSON-RPC（runAgent、getStatus、listAgents）
- [ ] `apps/server/src/remote/` 目录合并到主仓库（SSH 隧道 + 客户端 + 管理器）
- [ ] REST API `/api/v1/remote/servers` CRUD + 连接管理
- [ ] WebSocket 消息处理（remote.servers, directory:list, file:read 等）
- [ ] Orchestrator 远程模式支持
- [ ] 会话-服务器绑定
- [ ] 全栈编译通过 + 零错误

**验收标准：**

| ID | 验收标准 | 关联任务 |
|----|---------|---------|
| AC-01 | `remote_servers` 表创建成功，Migration 9 执行无报错 | T3-01 |
| AC-02 | `conversations` 表包含 `server_id` 列 | T3-01 |
| AC-03 | 共享类型包导出 `RemoteServerInfo`、`FileInfo` 等类型 | T3-02 |
| AC-04 | `pnpm install` 成功，lockfile 包含 `dashboard-remote-server` | T3-03 |
| AC-05 | `pnpm --filter @openclaw/dashboard-remote-server build` 编译通过 | T3-03 |
| AC-06 | `gateway.runAgent` JSON-RPC 方法可调用（不抛 "Not implemented"） | T3-04 |
| AC-07 | `apps/server/src/remote/` 目录存在且模块可导入 | T3-05 |
| AC-08 | `ssh2` 依赖已添加到 server package.json | T3-05 |
| AC-09 | REST API 7 个端点全部可调用，返回正确格式 | T3-08 |
| AC-10 | WebSocket `remote.servers`、`directory:list`、`file:read` 消息正常收发 | T3-09 |
| AC-11 | Orchestrator 根据 serverId 路由到远程/本地 | T3-10 |
| AC-12 | `conversation.create` 消息支持 `serverId` 参数 | T3-11 |
| AC-13 | TypeScript 全栈编译无错误 | T3-13 |

### 1.2 任务分解

| 任务 ID | 任务描述 | 类型 | 依赖 | 状态 |
|---------|---------|------|------|------|
| T3-01 | 数据库变更 — remote_servers 表 + server_id 列 | 数据库 | - | ✅ |
| T3-02 | 共享类型定义 — 远程连接类型 | 类型 | - | ✅ |
| T3-03 | 合并 dashboard-remote-server 包 | 包集成 | T3-02 | ✅ |
| T3-04 | Gateway 桥接接入 JSON-RPC | 后端 | T3-03 | ✅ |
| T3-05 | 合并 remote/ 模块到 Dashboard Server | 后端 | T3-01, T3-02 | ✅ |
| T3-06 | REST API 路由 — 远程服务器 CRUD | 后端 | T3-05 | ✅ |
| T3-07 | WebSocket 消息处理 — 远程相关消息 | 后端 | T3-05 | ✅ |
| T3-08 | Orchestrator 远程模式 | 后端集成 | T3-05 | ✅ |
| T3-09 | 会话-服务器绑定 | 后端+前端 | T3-07 | ✅ |
| T3-10 | 前端 WebSocket 补全 | 前端 | T3-07 | ✅ |
| T3-11 | app.ts 集成 — 路由注册 + 启动初始化 | 后端集成 | T3-06, T3-07 | ✅ |
| T3-12 | 端到端验证 | 验证 | T3-01~T3-11 | ✅ |

### 1.3 技术方案摘要

**涉及数据模型：**
- `remote_servers`: 远程服务器配置（id, name, host, port, username, private_key_path, remote_port）
- `conversations.server_id`: 会话归属服务器（TEXT, 可空, null 为本地）

**涉及 API 接口：**
- `GET/POST/PUT/DELETE /api/v1/remote/servers`: 服务器 CRUD
- `POST /api/v1/remote/servers/:id/connect|disconnect`: 连接/断开
- `PUT /api/v1/remote/active`: 切换活跃服务器
- WebSocket: `remote.servers`, `remote.switch`, `directory:list`, `file:read`, `watch.subscribe/unsubscribe`

**涉及前端页面/组件：**
- `ServerManager.tsx` / `ServerForm.tsx`: 已完成，依赖后端 API
- `FileExplorer.tsx` / `FilePreview.tsx`: 已完成，依赖后端 WS 消息
- `Sidebar.tsx`: 已完成服务器分组，需新增 serverId 传递
- `ArtifactsPanel.tsx`: 已完成 Tab 切换

**核心架构流程：**
```
前端 → WS/REST → Dashboard Server → SSH Tunnel → remote-server → Gateway
```

**已有代码（worktree 分支）：**
- `.worktrees/remote-connection/packages/dashboard-remote-server/` — 完整的 sidecar 包
- `.worktrees/remote-connection/apps/server/src/remote/` — SSH 隧道 + 客户端 + 管理器

---

## 2. Do（执行）

### 2.1 数据与类型任务

#### 任务 T3-01：数据库变更

**文件路径：** `apps/server/src/db/schema.sql`、`apps/server/src/db/index.ts`

**实现步骤：**
1. 在 `schema.sql` 末尾添加 `remote_servers` 表定义
2. 在 `index.ts` 的 `runMigrations()` 中添加 Migration 9：
   - 创建 `remote_servers` 表
   - `ALTER TABLE conversations ADD COLUMN server_id TEXT`
   - 检查列是否已存在（幂等）

**代码示例：** [snippets/迭代3/T3-01_schema.sql](snippets/迭代3/T3-01_schema.sql)

**完成标志：** 满足 AC-01, AC-02

---

#### 任务 T3-02：共享类型定义

**文件路径：** `packages/shared/types/src/index.ts`

**实现步骤：**
1. 在文件末尾（Rule 相关类型之后）添加远程连接类型定义：
   - `RemoteServerInfo` — 服务器信息接口
   - `RemoteServerStatus` — 状态枚举类型
   - `FileInfo` — 文件信息接口
   - `FileContent` — 文件内容接口
   - WebSocket 消息 Payload 类型（`WSRemoteServersPayload`、`WSDirectoryListPayload`、`WSFileReadPayload` 等）

**代码示例：** [snippets/迭代3/T3-02_shared-types.ts](snippets/迭代3/T3-02_shared-types.ts)

**完成标志：** 满足 AC-03

---

### 2.2 包集成任务

#### 任务 T3-03：合并 dashboard-remote-server 包

**源路径：** `.worktrees/remote-connection/packages/dashboard-remote-server/`
**目标路径：** `packages/dashboard-remote-server/`

**实现步骤：**
1. 复制整个 `dashboard-remote-server/` 目录到 `packages/`
2. 在 `pnpm-workspace.yaml` 中添加 `packages/dashboard-remote-server`
3. 确认 `packages/dashboard-remote-server/package.json` 中 `name` 为 `@openclaw/dashboard-remote-server`
4. 执行 `pnpm install` 更新 lockfile
5. 执行 `pnpm --filter @openclaw/dashboard-remote-server build` 编译验证
6. 检查依赖：`vscode-jsonrpc`、`ws`、`chokidar`、`pino`

**注意：** worktree 中的代码可能需要调整导入路径以匹配主仓库结构。

**完成标志：** 满足 AC-04, AC-05

---

#### 任务 T3-04：Gateway 桥接接入 JSON-RPC

**文件路径：** `packages/dashboard-remote-server/src/server/jsonRpcServer.ts`

**实现步骤：**
1. 修改 `setupMethods()` 方法，注册 Gateway 相关 JSON-RPC 方法：
   - `gateway.connect` — 连接本地 Gateway
   - `gateway.disconnect` — 断开 Gateway
   - `gateway.runAgent` — 发送 Agent 请求（当前抛 "Not implemented"，改为实际调用 `gatewayBridge.runAgent()`）
   - `gateway.getStatus` — 返回 Gateway 连接状态
   - `gateway.listAgents` — 返回可用 Agent 列表
2. 在 `RemoteServer.start()` 中初始化 `gatewayBridge`，移除 TODO 注释
3. 注册 Gateway 事件转发：`agentEvent` → JSON-RPC 通知

**代码示例：** [snippets/迭代3/T3-04_gateway-bridge.ts](snippets/迭代3/T3-04_gateway-bridge.ts)

**完成标志：** 满足 AC-06

---

### 2.3 Dashboard Server 后端任务

#### 任务 T3-05：合并 remote/ 模块

**源路径：** `.worktrees/remote-connection/apps/server/src/remote/`
**目标路径：** `apps/server/src/remote/`

**实现步骤：**
1. 复制整个 `remote/` 目录到 `apps/server/src/`
2. 文件清单：
   - `types.ts` — 类型定义（RemoteServerConfig, SSHTunnelStatus 等）
   - `sshTunnel.ts` — SSH 隧道管理器（使用 ssh2）
   - `client.ts` — JSON-RPC 客户端
   - `manager.ts` — 远程连接管理器
   - `index.ts` — 导出入口
3. 在 `apps/server/package.json` 中添加依赖：
   - `ssh2`（^1.15.0）
   - `@types/ssh2`（devDependencies）
   - `vscode-jsonrpc`（如未共享 remote-server 的版本）
4. 调整导入路径：确保 `../db` 导入正确，`@openclaw-dashboard/shared` 类型可用
5. 验证编译：`pnpm --filter @openclaw-dashboard/server build`

**完成标志：** 满足 AC-07, AC-08

---

#### 任务 T3-06：REST API 路由

**文件路径：** `apps/server/src/routes/remote.ts`（新建）

**实现步骤：**
1. 创建 `remote.ts` 路由文件，实现 7 个端点：
   - `GET /api/v1/remote/servers` — 获取所有服务器 + 状态
   - `POST /api/v1/remote/servers` — 添加服务器配置
   - `PUT /api/v1/remote/servers/:id` — 更新服务器配置
   - `DELETE /api/v1/remote/servers/:id` — 删除服务器
   - `POST /api/v1/remote/servers/:id/connect` — 建立连接
   - `POST /api/v1/remote/servers/:id/disconnect` — 断开连接
   - `PUT /api/v1/remote/active` — 切换活跃服务器
2. 每个端点调用 `RemoteConnectionManager` 对应方法
3. CRUD 操作同时操作 `remote_servers` 数据库表
4. 添加/删除/更新后重新加载管理器配置

**代码示例：** [snippets/迭代3/T3-08_remote-routes.ts](snippets/迭代3/T3-08_remote-routes.ts)

**完成标志：** 满足 AC-09

---

#### 任务 T3-07：WebSocket 消息处理

**文件路径：** `apps/server/src/routes/websocket.ts`（修改）

**实现步骤：**
1. 在文件顶部添加 `import { getRemoteConnectionManager } from '../remote'`
2. 在 `handleMessage` 的 switch 中添加以下 case：
   - `remote.servers` → 查询管理器返回服务器列表
   - `remote.switch` → 切换活跃服务器，广播 `remote.active`
   - `directory:list` → 代理到远程 JSON-RPC 客户端
   - `file:read` → 代理到远程 JSON-RPC 客户端
   - `watch.subscribe` → 代理文件监控订阅
   - `watch.unsubscribe` → 取消订阅
3. 添加 `send()` 辅助函数（向单个客户端发送）
4. 注册管理器状态变更回调，广播 `remote.server.status` 推送

**代码示例：** [snippets/迭代3/T3-09_websocket-handlers.ts](snippets/迭代3/T3-09_websocket-handlers.ts)

**完成标志：** 满足 AC-10

---

### 2.4 集成任务

#### 任务 T3-08：Orchestrator 远程模式

**文件路径：** `apps/server/src/services/orchestrator.ts`（修改）

**实现步骤：**
1. 添加 `import { getRemoteConnectionManager } from '../remote'`
2. 修改 `handleUserMessage` 方法签名，接受 `serverId?: string` 参数
3. 添加远程路由判断：有 `serverId` → `runViaRemote()`，无 → `runViaGateway()`
4. 新增 `runViaRemote()` 私有方法：
   - 获取远程客户端
   - 检查连接状态
   - 确保 Gateway 已连接
   - 注册事件监听转发到 Orchestrator 事件系统
   - 调用 `client.runAgent()`

**代码示例：** [snippets/迭代3/T3-10_orchestrator-remote.ts](snippets/迭代3/T3-10_orchestrator-remote.ts)

**完成标志：** 满足 AC-11

---

#### 任务 T3-09：会话-服务器绑定

**涉及文件：**
- `apps/server/src/routes/websocket.ts` — `handleConversationCreate` 添加 `serverId` 参数
- `apps/web/src/components/layout/Sidebar.tsx` — [+新] 按钮传递 `serverId`

**实现步骤：**

**后端：**
1. 修改 `handleConversationCreate` 解构中添加 `serverId`
2. INSERT 语句添加 `server_id` 列

**前端：**
1. 在 Sidebar 的服务器分组中，[+新] 按钮调用 `createConversation(undefined, server.id)`
2. 在 `chatStore.ts` 的 `createConversation` action 中添加 `serverId` 参数
3. WebSocket 发送 `conversation.create` 时携带 `serverId`

**代码示例：** [snippets/迭代3/T3-11_conversation-binding.ts](snippets/迭代3/T3-11_conversation-binding.ts)

**完成标志：** 满足 AC-12

---

#### 任务 T3-10：前端 WebSocket 补全

**涉及文件：**
- `apps/web/src/hooks/useWebSocket.ts` — 验证所有 WS 消息处理器正确
- `apps/web/src/stores/remoteStore.ts` — 验证 store 调用与后端消息对应

**实现步骤：**
1. 检查 `useWebSocket.ts` 中以下处理器是否与后端新增消息对齐：
   - `remote.servers` → `setServers()`
   - `remote.server.status` → `setServerStatus()`
   - `remote.active` → `switchServer()`
   - `directory:list:result` → `setFiles()` 或 `setError()`
   - `file:read:result` → `setFileContent()` 或 `setError()`
2. 检查 `remoteStore.ts` 中 REST API 调用路径是否正确：
   - `loadServers()` → `GET ${API_BASE}/remote/servers`
   - `connectServer(id)` → `POST ${API_BASE}/remote/servers/${id}/connect`
   - `disconnectServer(id)` → `POST ${API_BASE}/remote/servers/${id}/disconnect`
   - 等
3. 如有路径或参数不匹配，进行调整

**注意：** 前端代码大部分已实现，此任务主要是对齐验证和微调。

**完成标志：** 前端 WS 消息与后端完全对齐

---

#### 任务 T3-11：app.ts 集成

**文件路径：** `apps/server/src/app.ts`（修改）

**实现步骤：**
1. 添加 `import { remoteRoutes } from './routes/remote'`
2. 添加 `import { initRemoteConnectionManager } from './remote'`
3. 在路由注册区域添加 `await fastify.register(remoteRoutes, { prefix: '/api/v1' })`
4. 在 Gateway 初始化之后，初始化 `RemoteConnectionManager`：
   ```typescript
   // 初始化远程连接管理器
   const remoteManager = initRemoteConnectionManager(gatewayClient, broadcast);
   const servers = all('SELECT * FROM remote_servers');
   remoteManager.loadServerConfigs(servers);
   ```
5. 注册状态变更回调，通过 WebSocket 广播

**完成标志：** 路由注册成功，管理器初始化无报错

---

### 2.5 验证任务

#### 任务 T3-12：端到端验证

**验证步骤：**

| 步骤 | 操作 | 预期结果 | 关联 AC |
|------|------|----------|---------|
| 1 | `pnpm install` | 成功，包含 ssh2、dashboard-remote-server | AC-04 |
| 2 | `pnpm --filter @openclaw/dashboard-remote-server build` | 编译通过 | AC-05 |
| 3 | `pnpm --filter @openclaw-dashboard/server build` | 编译通过 | AC-13 |
| 4 | 启动 Dashboard Server | 无报错，Migration 9 执行成功 | AC-01, AC-02 |
| 5 | `curl http://localhost:3002/api/v1/remote/servers` | 返回 `{ success: true, data: [] }` | AC-09 |
| 6 | `curl -X POST http://localhost:3002/api/v1/remote/servers -H 'Content-Type: application/json' -d '{"name":"test","host":"127.0.0.1","username":"test"}'` | 返回创建的服务器对象 | AC-09 |
| 7 | 浏览器打开 Dashboard | 侧边栏显示服务器管理面板 | - |
| 8 | 添加服务器 → 连接 → 浏览文件 | 文件浏览器显示远程文件 | AC-10 |
| 9 | grep 无残留引用 | 无未使用的 TODO 或 stub 代码 | - |

**完成标志：** 全部 AC 通过

---

## 3. Check（检查）

### 3.1 功能验证清单

| 验证项 | 验证方法 | 预期结果 | 关联 AC | 状态 |
|--------|---------|---------|---------|------|
| remote_servers 表存在 | `sqlite3 data/dashboard.db ".tables"` | 包含 remote_servers | AC-01 | ⬜ |
| conversations 有 server_id | `PRAGMA table_info(conversations)` | 包含 server_id 列 | AC-02 | ⬜ |
| 共享类型导出 | TypeScript 编译 | RemoteServerInfo 等类型可用 | AC-03 | ⬜ |
| remote-server 包编译 | pnpm build | 零错误 | AC-04, AC-05 | ⬜ |
| Gateway 方法可用 | 调用 gateway.runAgent | 不抛 "Not implemented" | AC-06 | ⬜ |
| remote/ 模块可导入 | TypeScript 编译 | 零错误 | AC-07 | ⬜ |
| ssh2 依赖 | package.json 检查 | ssh2 在 dependencies | AC-08 | ⬜ |
| REST API 7 端点 | curl 测试 | 全部返回正确格式 | AC-09 | ⬜ |
| WS 消息收发 | 浏览器 + 服务端日志 | 消息正确路由 | AC-10 | ⬜ |
| Orchestrator 路由 | 检查代码逻辑 | 有 serverId 走远程，无走本地 | AC-11 | ⬜ |
| 会话绑定 | 创建会话时传 serverId | 数据库记录包含 server_id | AC-12 | ⬜ |
| 全栈编译 | pnpm build | 零错误 | AC-13 | ⬜ |

### 3.2 代码质量检查
- [ ] TypeScript 全栈编译无错误
- [ ] 无 "Not implemented" 残留（除 dashboard-remote-server 的 Gateway 方法在 T3-04 修复后）
- [ ] 无 TODO 注释残留
- [ ] `pnpm install` 无 peer dependency 警告

### 3.3 代码检查命令

```bash
# 检查全栈编译
pnpm --filter @openclaw/dashboard-remote-server build
pnpm --filter @openclaw-dashboard/server build
pnpm --filter @openclaw-dashboard/web build

# 检查无残留 stub
grep -rn "Not implemented" packages/dashboard-remote-server/src/ --include="*.ts"
# 预期：无结果（T3-04 完成后）

# 检查 remote/ 目录存在
ls apps/server/src/remote/
# 预期：index.ts, manager.ts, sshTunnel.ts, client.ts, types.ts

# 检查 REST API 端点
curl -s http://localhost:3002/api/v1/remote/servers | jq .
# 预期：{ "success": true, "data": [] }
```

---

## 4. 进度跟踪

| 任务 ID | 状态 | 完成时间 | 备注 |
|---------|------|---------|------|
| T3-01 | ✅ 已完成 | 2026-03-30 | 数据库变更 |
| T3-02 | ✅ 已完成 | 2026-03-30 | 共享类型 |
| T3-03 | ✅ 已完成 | 2026-03-30 | 合并 remote-server 包 |
| T3-04 | ✅ 已完成 | 2026-03-30 | Gateway 桥接 |
| T3-05 | ✅ 已完成 | 2026-03-30 | 合并 remote/ 模块 |
| T3-06 | ✅ 已完成 | 2026-03-30 | REST API 路由 |
| T3-07 | ✅ 已完成 | 2026-03-30 | WebSocket 消息处理 |
| T3-08 | ✅ 已完成 | 2026-03-30 | Orchestrator 远程模式 |
| T3-09 | ✅ 已完成 | 2026-03-30 | 会话-服务器绑定 |
| T3-10 | ✅ 已完成 | 2026-03-30 | 前端 WebSocket 补全 |
| T3-11 | ✅ 已完成 | 2026-03-30 | app.ts 集成 |
| T3-12 | ✅ 已完成 | 2026-03-30 | 端到端验证 |

**状态说明：** ⬜ 待开始 | 🔄 进行中 | ✅ 已完成 | ❌ 已取消

---

*生成时间：2026-03-30*
