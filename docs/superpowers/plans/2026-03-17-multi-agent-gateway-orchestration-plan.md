# 多 Agent Gateway 直连编排实施计划

> **For agentic workers:** 建议配合 `superpowers:executing-plans` / `subagent-driven-development` 执行本计划。步骤使用 `- [ ]` 复选框便于跟踪。

**Goal:**  
在不依赖 Dashboard Channel 插件的前提下，引入 **Gateway 直连多 Agent 管理与编排能力**，实现：

- 多个虚拟 Agent 的独立角色 / Prompt 管理
- 多会话、多 Agent 并发对话（不会互相阻塞）
- 由 Dashboard 充当 Orchestrator，实现 Agent 之间的“工作交接 / 移交”

**High-level Architecture（直连模式）**

- `apps/server` 中新增/扩展 `OpenclawGatewayClient`：
  - 维护到 Openclaw Gateway 的 WebSocket 连接（按官方协议握手）
  - 管理 `runId` → 本地会话/虚拟 Agent 的映射
  - 将 `event: "agent"` 流式结果转发给内存总线 / WebSocket `/ws`
- `apps/server` 中新增 Orchestrator 层：
  - 定义 `VirtualAgent` 抽象（id、rolePrompt、model 等）
  - 处理“工作交接”协议（如 `HANDOFF:<agentId>` 标记）
- `apps/web` 使用现有 WebSocket 通道接收：
  - 来自 Orchestrator 的消息 / 任务事件
  - 新增：可视化“当前由哪个 Agent 在回复”、交接信息等

---

## 文件结构 & 影响面

| 区域 | 文件 / 模块 | 变更类型 | 职责 |
|------|-------------|----------|------|
| 后端 | `apps/server/src/services/openclawGatewayClient.ts` | 新增 | 封装 Gateway WS 客户端（connect / agent / agent.wait / 事件分发） |
| 后端 | `apps/server/src/services/virtualAgents.ts` | 新增 | 定义 `VirtualAgent`、角色 Prompt、路由规则 |
| 后端 | `apps/server/src/services/orchestrator.ts` | 新增 | 统一入口，处理用户消息 → 选择 Agent → 调用 Gateway → 处理工作交接 |
| 后端 | `apps/server/src/routes/websocket.ts` | 修改 | 将前端的聊天事件交给 Orchestrator；接收 Orchestrator 输出转发到前端 |
| 后端 | `apps/server/src/config.ts` | 修改 | 增加 Openclaw Gateway 地址 / token / 默认 Agent 配置 |
| 共享 | `packages/shared/types/src/index.ts` | 修改 | 补充多 Agent / 交接相关类型（如 `ActiveAgentInfo`、`HandoffMeta`） |
| 前端 | `apps/web/src/stores/chatStore.ts` | 修改 | 增加当前 Agent、可用 Agents、交接事件的状态管理 |
| 前端 | `apps/web/src/hooks/useWebSocket.ts` | 修改 | 处理新的多 Agent / 交接相关 WS 消息类型 |
| 前端 | `apps/web/src/components/chat/ChatPanel.tsx` | 修改 | 展示当前 Agent 与交接过程（例如顶部 badge） |
| 前端 | `apps/web/src/components/layout/Sidebar.tsx` | 修改 |（可选）列表中按 Agent 分组或展示当前会话绑定的 Agent |

> 注：具体文件名可在实现时按现有项目结构微调，本计划重点在职责划分和步骤顺序。

---

## Chunk 1: Gateway 直连客户端封装（后端）

### Task 1.1: 定义配置 & 基本类型

**Files**
- Modify: `apps/server/src/config.ts`
- Modify: `packages/shared/types/src/index.ts`

- [ ] **Step 1:** 在 `config.ts` 中增加 Openclaw Gateway 配置段：
  - `openclawGateway.url`（如 `wss://gateway.example/ws`）
  - `openclawGateway.token`（对应 `connect.params.auth.token`）
  - 可选：TLS 配置 / 设备指纹固定（预留）
- [ ] **Step 2:** 在 shared types 中增加基础类型：
  - `VirtualAgentId`（string alias）
  - `ActiveAgentInfo`（包含 virtualAgentId, displayName, color? 等）
  - `GatewayRunRef`（{ runId, virtualAgentId, conversationId }）

### Task 1.2: 实现 `OpenclawGatewayClient`

**File**
- Add: `apps/server/src/services/openclawGatewayClient.ts`

核心目标：**单例式** Gateway 客户端，负责：

- 维护 WebSocket 连接（自动重连）
- 完成 Gateway `connect.challenge` → `connect` 握手
- 暴露方法：
  - `start()` / `stop()`
  - `runAgent(options): Promise<{ runId }>`：发起一次 agent 调用
  - `waitRun(runId, options): Promise<...>`（可选）
  - `onAgentEvent(handler)`：订阅 `event: "agent"` 流式结果

- [ ] **Step 1:** 完成 WebSocket 连接与握手逻辑
  - 收到 `connect.challenge` 事件后，发送 `type:"req", method:"connect"`，携带：
    - `minProtocol` / `maxProtocol`
    - `client` 信息（id/version/platform）
    - `role: "operator"`（或更合适的角色）
    - `scopes`: 至少包含能调用 `agent` 所需的操作范围
    - `auth.token`: 使用 `config.openclawGateway.token`
- [ ] **Step 2:** 支持发送 `agent` 请求
  - 封装一个 `sendReq(method, params)`，自动生成 `id`，等待 `res`
  - `runAgent` 内部调用 `sendReq("agent", {...})`，返回 `runId`
- [ ] **Step 3:** 处理 `event: "agent"` 流式事件
  - 解析出 `runId` / `stream` / `data.delta` 等
  - 将事件分发给订阅者（例如 `onAgentEvent` 回调队列）
- [ ] **Step 4:** 自动重连策略
  - 连接断开时（非显式 stop），按固定间隔（如 5 秒）重试
  - 暂时可以**不做** run 恢复，只要在文档里说明“断线期间的 run 不保证回放”

---

## Chunk 2: 虚拟 Agent 抽象 & Orchestrator（后端）

### Task 2.1: 定义 `VirtualAgent` 抽象

**File**
- Add: `apps/server/src/services/virtualAgents.ts`

设计一个纯 TypeScript 层的抽象，用来描述“虚拟 Agent”：

- `id: VirtualAgentId`
- `displayName: string`
- `description?: string`
- `systemPrompt: string`
- `model?: string`
- 可选：
  - 默认是否允许作为“交接目标”
  - 优先级 / tag（如 `research` / `code`）

- [ ] **Step 1:** 导出 `VirtualAgent` 类型和一个 `virtualAgentsRegistry`
  - 简单方式：在文件里直接定义几个内置 Agent（如 `researcher`, `coder`）
  - 未来可以改为从配置 / DB 读取
- [ ] **Step 2:** 提供工具函数：
  - `getVirtualAgent(id)` / `listVirtualAgents()`

### Task 2.2: Orchestrator：用户消息 → 选择 Agent → 调用 Gateway

**File**
- Add: `apps/server/src/services/orchestrator.ts`

职责：

- 入口：`handleUserMessage({ conversationId, content, ... })`
- 步骤：
  1. 根据会话状态 / 显式指定的 Agent，确定本次要调用的 `virtualAgentId`
  2. 拼接系统 prompt + 历史上下文 + 当前用户消息
  3. 调用 `OpenclawGatewayClient.runAgent(...)`，获得 `runId`
  4. 注册 run → 会话 / Agent 的映射，以便后续流式事件路由

- [ ] **Step 1:** 定义 Orchestrator 的公共接口：
  - `handleUserMessage(...)`
  - `handleGatewayEvent(event)`（由 GatewayClient 回调调用）
- [ ] **Step 2:** 在 `handleGatewayEvent` 中：
  - 根据 run 映射找到对应的会话 / Agent
  - 将 delta / 完整消息转换成内部统一消息结构
  - 推送到 WebSocket `/ws`，供前端展示

---

## Chunk 3: 工作交接 / Agent 调 Agent（后端协议）

### Task 3.1: 定义交接协议（标记格式）

**Files**
- Modify: `packages/shared/types/src/index.ts`
- Modify: `apps/server/src/services/orchestrator.ts`

设计一个**简单、可解析**的交接标记，例如：

- `HANDOFF:agent_id:reason(optional)` 独立成一行
- 或者嵌入 markdown 注释行

- [ ] **Step 1:** 在 shared types 中定义：
  - `HandoffInstruction`（{ fromAgentId, toAgentId, reason?, context? }）
- [ ] **Step 2:** 在 Orchestrator 中添加解析函数：
  - 输入：Agent 输出文本
  - 输出：`{ cleanContent, handoff?: HandoffInstruction }`

### Task 3.2: 实现 Orchestrator 内部的“交接”逻辑

- [ ] **Step 1:** 当解析到 `handoff` 时：
  - 结束当前 run 的“ownership”（但不强制中断，主要是逻辑所有权）
  - 构造对目标 Agent 的新调用：
    - 带上必要上下文（用户原始问题 + 当前 Agent 结论摘要等）
    - 作为新的 `runId` 发送到 Gateway
  - 在会话记录中插入一条“系统消息”：如“已从 A 移交给 B”
- [ ] **Step 2:** 确保不会产生无限交接：
  - 在会话 / run 上增加一个简单的 `handoffDepth` 限制（例如最多 2~3 次）

---

## Chunk 4: WebSocket 协议扩展 & 前端状态

### Task 4.1: 扩展后端 `/ws` 消息类型

**File**
- Modify: `apps/server/src/routes/websocket.ts`

在现有 WebSocket 协议基础上，增加：

- 服务端 → 前端：
  - `agent.active`：{ conversationId, agent: ActiveAgentInfo }
  - `agent.handoff`：{ conversationId, fromAgentId, toAgentId, reason? }
- 前端 → 服务端：
  - `chat.send` 中允许带上 `virtualAgentId`（可选，未指定则用会话默认）

- [ ] **Step 1:** 更新路由处理逻辑：
  - `chat.send` → 调用 Orchestrator，并将 `virtualAgentId` 透传
  - 接收 Orchestrator 推送的多 Agent 事件，转发到前端

### Task 4.2: 前端 store：多 Agent & 交接状态

**File**
- Modify: `apps/web/src/stores/chatStore.ts`

增加：

- `availableAgents: ActiveAgentInfo[]`
- `currentAgentByConversation: Record<conversationId, ActiveAgentInfo>` 或等价结构
- 处理：
  - `agent.active` → 更新当前会话的 active Agent
  - `agent.handoff` → 在消息列表插入一条系统消息 / 更新当前 Agent

- [ ] **Step 1:** 更新状态类型与初始化
- [ ] **Step 2:** 实现处理新消息类型的 reducer / actions

### Task 4.3: 前端 UI：展示当前 Agent & 交接

**Files**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`（可选）

- [ ] **Step 1:** 在 Chat 头部或消息列表顶部展示当前 Agent：
  - 例如一个小 badge：“当前由 Researcher Agent 回复”
- [ ] **Step 2:** 当收到 `agent.handoff` 事件时：
  - 在消息流中插入“系统提示消息”，说明从哪个 Agent 移交到哪个 Agent
- [ ] **Step 3（可选）:** 在 Sidebar 中展示会话绑定的 Agent（图标/颜色）

---

## 验收标准（Acceptance Criteria）

- **并发与独立性**
  - [ ] 在 Dashboard 上同时对两个不同会话发起请求时，两个会话都能并行收到流式输出，没有相互阻塞。
  - [ ] 单个会话中连续快速发送多条消息，后端为每条创建独立 run，前端能正确按时间顺序渲染。

- **多 Agent 管理**
  - [ ] 前端能列出可用的虚拟 Agent（至少 2 个），并允许选择某个 Agent 作为当前会话的“负责者”。
  - [ ] 不同虚拟 Agent 的角色 / Prompt 差异能在回复风格中观察到（例如一个偏调研，一个偏代码）。

- **工作交接**
  - [ ] 当某个 Agent 输出内嵌的交接标记（如 `HANDOFF:code`）时，Orchestrator 能正确解析并将会话移交给目标 Agent。
  - [ ] 交接时，前端能看到一条系统提示，清楚知道“从 A 移交到 B”。
  - [ ] 交接链路有最大深度限制，避免无限 Agent 互调。

- **故障与恢复**
  - [ ] Gateway 连接短暂断开后自动重连成功，新的用户消息仍能正常发送；页面有合适的“连接中/已断开”提示（可复用现有 UI 模式）。

---

## 风险与注意事项

1. **协议复杂度**  
   - 直接使用 Gateway 协议意味着需要严格遵守官方文档（`connect` 握手、幂等键、权限 scope 等）。  
   - 建议：将协议细节**完全封装**在 `OpenclawGatewayClient` 内，对上层只暴露简单 API。

2. **安全与权限**  
   - Dashboard 作为 `operator` 客户端，拥有较强控制能力；Gateway token 泄露风险较大。  
   - 建议：将 token 放在安全存储中，限制 Dashboard 所在网络/机器；未来可以考虑更细粒度的 scopes。

3. **成本与调用爆炸**  
   - 多 Agent + 自动交接极易导致调用数量增加。  
   - 建议：在 Orchestrator 中增加简单的预算/调用次数限制（例如每个会话最大 run 数量、最大交接深度）。

4. **渐进式集成策略**  
   - 初期可以在配置中保留“Dashboard Channel 模式”和“Gateway 直连模式”开关，只在本地 / 小规模场景使用直连。  
   - 逐步观察稳定性与开发者体验，再考虑是否完全迁移。

