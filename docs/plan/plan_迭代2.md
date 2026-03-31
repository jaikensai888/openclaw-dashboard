# 迭代 2 执行计划：移除插件模式，启用 Gateway 直连

*基于 TODOLIST 生成，包含完整的 Plan-Do-Check 执行方案*
*代码示例：[snippets/迭代2/](snippets/迭代2/)*

---

## 0. 修改记录（CHANGELOG）

| 版本 | 日期 | 修改类型 | 修改内容摘要 | 修改人/来源 | 状态 |
|------|------|---------|-------------|------------|------|
| 1.0.0 | 2026-03-30 | 初始创建 | 基于 TODOLIST 生成初始计划 | Claude | ✅ 已确认 |

---

## 1. Plan（计划）

### 1.1 迭代目标

**目标描述：** 移除 dashboard-plugin 包和插件连接模式，统一使用 Gateway 直连作为唯一 AI 后端连接方式。

**交付物清单：**
- [ ] 删除 `packages/dashboard-plugin/` 整个目录
- [ ] 删除 `pluginManager.ts` 和 `routes/plugin.ts`
- [ ] 简化 `websocket.ts` 为仅 Gateway 模式
- [ ] 清理 `app.ts` 移除插件相关代码
- [ ] 清理配置文件移除 `PLUGIN_TOKEN` / `plugin` 字段
- [ ] 更新 `.env` 启用 Gateway 直连
- [ ] 清理共享类型中的插件 WebSocket 类型
- [ ] 更新设计文档

**验收标准：**

| ID | 验收标准 | 关联任务 |
|----|---------|---------|
| AC-01 | `packages/dashboard-plugin/` 目录不存在 | T2-01 |
| AC-02 | `pnpm install` 成功，lockfile 不包含 dashboard-plugin | T2-01 |
| AC-03 | 服务启动无报错，无 plugin 相关日志 | T2-02, T2-03, T2-04 |
| AC-04 | `/ws/plugin` 端点返回 404 | T2-03 |
| AC-05 | `/api/debug/plugins` 和 `/api/debug/test-plugin` 端点不存在 | T2-03 |
| AC-06 | Gateway 直连工作正常（发送消息收到 AI 回复） | T2-04 |
| AC-07 | Gateway 未连接时，错误消息更新为直连模式提示 | T2-04 |
| AC-08 | 代码中无 `pluginManager`、`pluginRoutes`、`PLUGIN_TOKEN` 引用 | T2-05 |
| AC-09 | `packages/shared/types/src/index.ts` 无插件 WebSocket 类型 | T2-06 |

### 1.2 任务分解

| 任务 ID | 任务描述 | 类型 | 依赖 | 状态 |
|---------|---------|------|------|------|
| T2-01 | 删除 packages/dashboard-plugin 包 | 删除 | - | ⬜ |
| T2-02 | 删除插件服务代码 | 删除 | - | ⬜ |
| T2-03 | 清理 app.ts 移除插件相关代码 | 后端重构 | T2-02 | ⬜ |
| T2-04 | 简化 websocket.ts 移除插件 fallback | 后端重构 | T2-02 | ⬜ |
| T2-05 | 清理配置和入口文件 | 配置清理 | T2-02 | ⬜ |
| T2-06 | 清理共享类型 | 类型清理 | T2-02 | ⬜ |
| T2-07 | 清理 README | 文档 | - | ⬜ |
| T2-08 | 更新设计文档 | 文档 | T2-03, T2-04 | ⬜ |
| T2-09 | 端到端验证 | 验证 | T2-01~T2-08 | ⬜ |

### 1.3 技术方案摘要

**本次迭代核心变更**：移除"双模式"架构，统一为 Gateway 直连。

**变更前后对比：**

```
变更前:
  websocket.ts → 先尝试 Gateway → 失败则 fallback 到 pluginManager
  app.ts → 注册 /ws/plugin 路由 + 调试端点
  config.ts → plugin.token 字段
  index.ts → plugin 配置

变更后:
  websocket.ts → 仅 Gateway 直连，失败则返回错误消息
  app.ts → 仅注册 /ws 前端路由 + Gateway 调试端点
  config.ts → 无 plugin 字段
  index.ts → 无 plugin 配置
```

---

## 2. Do（执行）

### 2.1 删除任务

#### 任务 T2-01：删除 packages/dashboard-plugin 包

**文件路径：** `packages/dashboard-plugin/`

**实现步骤：**
1. 删除整个 `packages/dashboard-plugin/` 目录
2. 执行 `pnpm install` 更新 lockfile

**完成标志：** 满足 AC-01, AC-02

---

#### 任务 T2-02：删除插件服务代码

**删除文件：**
- `apps/server/src/services/pluginManager.ts`
- `apps/server/src/routes/plugin.ts`

**实现步骤：**
1. 删除 `pluginManager.ts`（整个文件 143 行）
2. 删除 `routes/plugin.ts`（整个文件，包含 `/ws/plugin` 路由定义和认证逻辑）

**完成标志：** 文件不存在

---

### 2.2 后端重构任务

#### 任务 T2-03：清理 app.ts

**文件路径：** `apps/server/src/app.ts`

**实现步骤：**
1. 移除 `import { pluginRoutes }` 导入（第 18 行）
2. 移除 `import { pluginManager }` 导入（第 19 行）
3. 移除 Gateway 失败时的 "Falling back to plugin mode" 日志（第 48 行）
4. 移除 else 分支中的 "plugin mode" 日志（第 52-54 行），改为一致的初始化日志
5. 删除 `GET /api/debug/plugins` 调试端点（第 78-82 行）
6. 删除 `POST /api/debug/test-plugin` 调试端点（第 97-119 行）
7. 移除 `await fastify.register(pluginRoutes)` 路由注册（第 135 行）
8. 移除启动横幅中的 `Plugin WS` 行（第 166 行）

**代码示例：** [snippets/迭代2/T2-03_app.ts](snippets/迭代2/T2-03_app.ts)

**完成标志：** 满足 AC-03, AC-04, AC-05

---

#### 任务 T2-04：简化 websocket.ts

**文件路径：** `apps/server/src/routes/websocket.ts`

**实现步骤：**
1. 移除 `import { pluginManager }` 导入（第 10 行）
2. 移除 `setupPluginMessageHandlers()` 调用（第 33 行）
3. 重写 `handleChatSend` 函数中的 Gateway 失败处理（第 262-312 行）：
   - 移除 Gateway error 后 fallback 到 plugin 的逻辑
   - 移除整个 "Fallback to plugin mode" 代码块（第 279-312 行）
   - Gateway 不可用时直接返回错误消息
   - 更新错误消息为 Gateway 直连模式提示
4. 删除整个 `setupPluginMessageHandlers()` 函数（第 433-489 行）

**关键代码变更 — handleChatSend 的结尾部分：**

变更前（第 262-312 行）：
```typescript
if (gatewayConnected) {
    // ... try gateway
    if (result.error) {
      console.log(`[WS] Gateway error: ${result.error}, falling back to plugin`);
    } else {
      return;
    }
  }
  // Fallback to plugin mode (lines 279-312) → 整段删除
```

变更后：
```typescript
if (gatewayConnected) {
    console.log(`[WS] Using Gateway connection`);
    const result = await orchestrator.handleUserMessage({
      conversationId, content, virtualAgentId, expertSystemPrompt,
    });
    if (result.error) {
      console.log(`[WS] Gateway error: ${result.error}`);
      const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const errorMsg = `Gateway 请求失败: ${result.error}`;
      run(`INSERT INTO messages ...`, [assistantMessageId, conversationId, errorMsg, now]);
      broadcast('chat.message', { ... });
    } else {
      console.log(`[WS] Gateway accepted, runId: ${result.runId}`);
      return;
    }
  } else {
    // Gateway 未连接
    const assistantMessageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const errorMsg = 'Gateway 未连接。请检查 OPENCLAW_GATEWAY_URL 配置。';
    run(`INSERT INTO messages ...`, [assistantMessageId, conversationId, errorMsg, now]);
    broadcast('chat.message', { ... });
  }
```

**代码示例：** [snippets/迭代2/T2-04_websocket.ts](snippets/迭代2/T2-04_websocket.ts)

**完成标志：** 满足 AC-06, AC-07

---

#### 任务 T2-05：清理配置和入口文件

**涉及文件（多个）：**

**5a. `apps/server/src/config.ts`：**
- 从 `AppConfig` 接口移除 `plugin?: { token?: string }` 字段（第 22-24 行）
- 从 `createConfig()` 移除 `plugin` 合并逻辑（第 45 行）
- 从 `loadConfigFromEnv()` 移除 `PLUGIN_TOKEN` 读取（第 69-70 行）

**5b. `apps/server/src/index.ts`：**
- 移除 `plugin` 配置对象（第 36-38 行）

**5c. `apps/server/src/services/orchestrator.ts`：**
- 更新 `start()` 方法日志：移除 "plugin mode only" 文字（第 106 行）
- 更新 `handleUserMessage()` 返回的错误消息（第 175 行）

**5d. `apps/server/.env.example`：**
- 移除 `PLUGIN_TOKEN=your-secure-token` 行
- 更新注释：移除 "falls back to plugin mode"

**5e. `.env`（根目录）：**
- 取消注释 `OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789`
- 取消注释 `OPENCLAW_GATEWAY_TOKEN=8e9f267cb17623c1883f3363b7addd605769154714c124fe`

**完成标志：** 满足 AC-08

---

### 2.3 清理任务

#### 任务 T2-06：清理共享类型

**文件路径：** `packages/shared/types/src/index.ts`

**实现步骤：**
1. 删除第 167-194 行的插件相关类型：
   - `WSPluginAuthPayload`
   - `WSAgentMessagePayload`
   - `WSAgentStreamingPayload`
   - `WSAgentMediaPayload`
   - `WSUserMessagePayload`
2. 删除注释分隔线 `// Plugin -> Server` 和 `// Server -> Plugin`

**保留的类型：** 所有非插件类型（Conversation、Message、Task、Gateway、Agent 等）

**完成标志：** 满足 AC-09

---

#### 任务 T2-07：清理 README

**文件路径：** `README.md`

**实现步骤：**
1. 移除插件安装/配置/使用说明段落（涉及第 82、111、113-141、181-186 行）
2. 更新架构说明为仅 Gateway 直连模式

**完成标志：** README 中无 dashboard-plugin 相关内容

---

#### 任务 T2-08：更新设计文档

**涉及文件：**
- `docs/prd/02_TECH.md` — 移除插件相关架构描述
- `docs/prd/00_PRD_GRAPH.md` — 目录结构中移除 `dashboard-plugin`

**02_TECH.md 需移除的内容：**
- 第 71 行：`@openclaw-dashboard/dashboard-plugin` 共享包条目
- 第 122 行：`/ws/plugin` 路由
- 第 262 行：`plugin.ts` 路由文件
- 第 275 行：`pluginManager.ts` 服务文件
- 第 298 行：`dashboard-plugin/` 目录
- 第 532 行：`PLUGIN_TOKEN` 环境变量
- 2.3 共享包表格中的 dashboard-plugin 行
- 7.2 双模式支持图 → 简化为 Gateway 直连图
- 8.1 认证机制表中的插件 WebSocket 行

**00_PRD_GRAPH.md 需修改：**
- 目录结构中 `dashboard-plugin/  # Openclaw 插件` → 移除

**完成标志：** 设计文档与代码一致

---

### 2.4 验证任务

#### 任务 T2-09：端到端验证

**验证步骤：**

| 步骤 | 操作 | 预期结果 | 关联 AC |
|------|------|----------|---------|
| 1 | `rm -rf node_modules && pnpm install` | 成功，无 dashboard-plugin 引用 | AC-02 |
| 2 | `./run.sh` 启动服务 | 启动成功，无 plugin 相关日志 | AC-03 |
| 3 | `curl http://localhost:3002/api/debug/gateway` | 返回 gateway 状态 JSON | - |
| 4 | `curl http://localhost:3002/ws/plugin` | 连接被拒 / 404 | AC-04 |
| 5 | `curl http://localhost:3002/api/debug/plugins` | 404 | AC-05 |
| 6 | 浏览器打开 Dashboard，发送消息 | Gateway 直连正常响应 | AC-06 |
| 7 | 断开 Gateway 后发送消息 | 显示 "Gateway 未连接" 错误提示 | AC-07 |

**完成标志：** 全部 AC 通过

---

## 3. Check（检查）

### 3.1 功能验证清单

| 验证项 | 验证方法 | 预期结果 | 关联 AC | 状态 |
|--------|---------|---------|---------|------|
| dashboard-plugin 目录不存在 | `ls packages/dashboard-plugin` | No such file | AC-01 | ⬜ |
| pnpm install 成功 | 执行安装命令 | 无错误 | AC-02 | ⬜ |
| 服务启动无 plugin 日志 | 检查启动输出 | 无 plugin 相关日志 | AC-03 | ⬜ |
| /ws/plugin 端点不可用 | curl 测试 | 404 | AC-04 | ⬜ |
| 调试端点已移除 | curl 测试 | 404 | AC-05 | ⬜ |
| Gateway 直连正常 | 发送消息 | 收到回复 | AC-06 | ⬜ |
| 错误提示正确 | 断开 Gateway 后测试 | "Gateway 未连接" | AC-07 | ⬜ |
| 无 plugin 代码残留 | grep 搜索 | 无结果 | AC-08 | ⬜ |
| 共享类型已清理 | 检查 index.ts | 无插件类型 | AC-09 | ⬜ |

### 3.2 代码质量检查
- [ ] TypeScript 编译无错误（`pnpm --filter @openclaw-dashboard/server build`）
- [ ] 无 `pluginManager` / `pluginRoutes` / `PLUGIN_TOKEN` 残留引用
- [ ] 无 `dashboard-plugin` 残留引用（grep 验证）

### 3.3 残留检查命令

```bash
# 检查后端代码中是否有插件相关引用
grep -rn "pluginManager\|pluginRoutes\|PLUGIN_TOKEN\|plugin\.ts\|pluginManager\.ts" apps/server/src/ --include="*.ts"
# 预期：无结果

# 检查共享类型中是否有插件类型
grep -n "WSPluginAuth\|WSUserMessage\|WSAgentMessage\|WSAgentStreaming\|WSAgentMedia" packages/shared/types/src/index.ts
# 预期：无结果

# 检查 dashboard-plugin 目录
ls packages/dashboard-plugin 2>/dev/null
# 预期：No such file or directory
```

---

## 4. 进度跟踪

| 任务 ID | 状态 | 完成时间 | 备注 |
|---------|------|---------|------|
| T2-01 | ✅ 已完成 | 2026-03-30 | 删除 dashboard-plugin 包 |
| T2-02 | ✅ 已完成 | 2026-03-30 | 删除 pluginManager + plugin 路由 |
| T2-03 | ✅ 已完成 | 2026-03-30 | 清理 app.ts |
| T2-04 | ✅ 已完成 | 2026-03-30 | 简化 websocket.ts |
| T2-05 | ✅ 已完成 | 2026-03-30 | 清理配置和入口 |
| T2-06 | ✅ 已完成 | 2026-03-30 | 清理共享类型 |
| T2-07 | ✅ 已完成 | 2026-03-30 | 清理 README |
| T2-08 | ✅ 已完成 | 2026-03-30 | 更新设计文档 |
| T2-09 | ✅ 已完成 | 2026-03-30 | 端到端验证：编译通过、零残留 |

**状态说明：** ⬜ 待开始 | 🔄 进行中 | ✅ 已完成 | ❌ 已取消

---

*生成时间：2026-03-30*
