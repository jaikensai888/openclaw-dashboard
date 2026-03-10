# Openclaw Dashboard 设计文档

> 创建日期: 2026-03-05
> 更新日期: 2026-03-06
> 状态: 已确认

## 1. 项目概述

### 1.1 背景

Openclaw 是一个 AI Agent Gateway，支持多渠道（Telegram、Discord、WhatsApp、WebChat 等）接入。

本项目是一个 **个人使用的 Web 聊天界面**，类似于 ChatGPT Web，用于与 Openclaw Agent 进行交互。Dashboard 后端部署在与 Openclaw 不同的服务器上，通过 **Dashboard 插件** 与 Openclaw 进行通信。

### 1.2 目标

创建一个 Web 聊天界面（Dashboard），用于：
- 提供类似 ChatGPT 的聊天体验
- 支持实时流式输出
- 实现后台任务管理（任务即消息卡片）
- 通过 Openclaw 插件机制与 Openclaw Agent 通信

### 1.3 核心特性

| 特性 | 描述 |
|------|------|
| **实时聊天** | 类似 ChatGPT 的聊天界面，支持流式输出 |
| **任务追踪** | 通过内联标记识别任务状态，显示为任务卡片 |
| **流式响应** | 实时显示 Agent 的回复内容 |
| **历史记录** | 持久化会话和消息，支持历史查看 |

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户浏览器                                 │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     Next.js Frontend                         │   │
│   │   ┌────────────────────────────────────────────────────┐    │   │
│   │   │                  Chat Panel                         │    │   │
│   │   │   - 消息列表 (MessageList)                          │    │   │
│   │   │   - 任务卡片 (TaskCard)                             │    │   │
│   │   │   - 输入框 (InputBar)                               │    │   │
│   │   └────────────────────────────────────────────────────┘    │   │
│   │                              │                                │   │
│   │              ┌────────────────────────────┐                  │   │
│   │              │    WebSocket Client        │                  │   │
│   │              │    (连接 Dashboard Backend)│                  │   │
│   │              └────────────────────────────┘                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        WebSocket + HTTP
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Dashboard Backend (Server B)                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     Core Services                             │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│   │   │  WebSocket   │  │    Task      │  │    Message       │  │   │
│   │   │  Server      │  │    Parser    │  │    Store         │  │   │
│   │   │  (前端连接)   │  │  (协议解析)   │  │  (SQLite)       │  │   │
│   │   └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│   │           │                  │                    │          │   │
│   │           └──────────────────┼────────────────────┘          │   │
│   │                              ▼                                │   │
│   │              ┌────────────────────────────┐                  │   │
│   │              │    WebSocket Server        │                  │   │
│   │              │    (接收插件连接)           │                  │   │
│   │              └────────────────────────────┘                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        WebSocket (Dashboard Protocol)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Openclaw Gateway (Server A)                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  Dashboard Plugin                             │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│   │   │  Gateway     │  │    Message   │  │    Outbound      │  │   │
│   │   │  (WS Client) │  │    Handler   │  │    (发送消息)     │  │   │
│   │   └──────────────┘  └──────────────┘  └──────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                │                                     │
│                                ▼                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Agent Core                                 │   │
│   │   - 消息处理                                                   │   │
│   │   - 任务执行                                                   │   │
│   │   - 流式响应                                                   │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 架构说明：插件模式

**关键设计决策：使用 Openclaw 插件**

Dashboard 后端部署在与 Openclaw **不同的服务器**上。通过创建一个 **Dashboard 插件**，使 Openclaw 能够与 Dashboard 后端进行通信。

**通信方向：**
- **Openclaw → Dashboard**：Agent 的响应（包括流式输出、任务状态）通过插件发送到 Dashboard 后端
- **Dashboard → Openclaw**：用户的消息从 Dashboard 后端发送到插件，再注入到 Openclaw 的消息处理流程

### 2.3 数据流

**聊天流程：**
```
用户输入 → Frontend → WS → Dashboard Backend → WS → Dashboard Plugin → Openclaw
                                                                            ↓
用户看到响应 ← Frontend ← WS ← Dashboard Backend ← WS ← Dashboard Plugin ← Agent
```

**流式输出：**
```
Agent 生成内容 → Plugin → WS → Dashboard Backend → WS → Frontend 实时显示
```

**任务追踪：**
```
Agent 输出 [TASK:START:...] → Plugin 转发 → Backend 解析 → 创建任务记录
                ↓
Agent 输出 [TASK:PROGRESS:...] → Plugin 转发 → Backend 更新 → 推送到 Frontend
                ↓
Agent 输出 [TASK:DONE] → Plugin 转发 → Backend 完成 → 推送最终状态
```

---

## 2.4 Dashboard 插件设计

Dashboard 插件是一个 Openclaw Channel Plugin，用于连接 Openclaw 和 Dashboard Backend。

### 2.4.1 插件结构

```
dashboard-plugin/
├── index.ts                    # 插件入口
├── openclaw.plugin.json        # 插件配置
├── src/
│   ├── channel.ts              # Channel 插件定义
│   ├── config.ts               # 配置解析
│   ├── gateway.ts              # WebSocket 连接到 Dashboard Backend
│   ├── outbound.ts             # 发送消息到 Dashboard Backend
│   ├── types.ts                # 类型定义
│   └── runtime.ts              # 运行时存储
└── package.json
```

### 2.4.2 插件入口 (index.ts)

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { dashboardPlugin } from "./src/channel.js";
import { setDashboardRuntime } from "./src/runtime.js";

const plugin = {
  id: "dashboard",
  name: "Dashboard Channel",
  description: "Connect Openclaw to Dashboard Backend for web chat interface",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setDashboardRuntime(api.runtime);
    api.registerChannel({ plugin: dashboardPlugin });
  },
};

export default plugin;
```

### 2.4.3 Channel 插件定义 (channel.ts)

```typescript
import { type ChannelPlugin, type OpenClawConfig } from "openclaw/plugin-sdk";
import { type ResolvedDashboardAccount } from "./types.js";
import { sendText, sendMedia } from "./outbound.js";
import { startGateway } from "./gateway.js";

export const dashboardPlugin: ChannelPlugin<ResolvedDashboardAccount> = {
  id: "dashboard",
  meta: {
    id: "dashboard",
    label: "Dashboard",
    selectionLabel: "Dashboard Web Chat",
    docsPath: "/docs/channels/dashboard",
    blurb: "Connect to Dashboard Backend for web-based chat interface",
    order: 10,
  },
  capabilities: {
    chatTypes: ["direct"],  // 仅支持私聊
    media: true,            // 支持发送媒体
    reactions: false,
    threads: false,
    blockStreaming: false,  // 支持流式输出
  },
  config: {
    listAccountIds: (cfg) => listDashboardAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveDashboardAccount(cfg, accountId),
    defaultAccountId: (cfg) => resolveDefaultDashboardAccountId(cfg),
    isConfigured: (account) => Boolean(account?.backendUrl),
    describeAccount: (account) => ({
      accountId: account?.accountId ?? DEFAULT_ACCOUNT_ID,
      name: account?.name ?? "Dashboard",
      enabled: account?.enabled ?? false,
      configured: Boolean(account?.backendUrl),
    }),
  },
  setup: {
    validateInput: ({ input }) => {
      if (!input.backendUrl) {
        return "Dashboard requires --backend-url parameter";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      return applyDashboardAccountConfig(cfg, accountId, {
        backendUrl: input.backendUrl,
        name: input.name,
      });
    },
  },
  messaging: {
    normalizeTarget: (target: string) => {
      // dashboard:conversation:xxx 格式
      const id = target.replace(/^dashboard:/i, "");
      if (id.startsWith("conversation:")) {
        return { ok: true, to: `dashboard:${id}` };
      }
      return { ok: true, to: `dashboard:conversation:${id}` };
    },
    targetResolver: {
      looksLikeId: (id: string) => {
        return /^dashboard:/.test(id) || /^conv_[a-zA-Z0-9]+$/.test(id);
      },
      hint: "Dashboard 目标格式: dashboard:conversation:xxx",
    },
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    sendText: async ({ to, text, accountId, cfg }) => {
      const account = resolveDashboardAccount(cfg, accountId);
      const result = await sendText({ to, text, account });
      return {
        channel: "dashboard",
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
      const account = resolveDashboardAccount(cfg, accountId);
      const result = await sendMedia({ to, text, mediaUrl, account });
      return {
        channel: "dashboard",
        messageId: result.messageId,
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { account, abortSignal, log } = ctx;
      log?.info(`[dashboard:${account.accountId}] Starting gateway`);

      await startGateway({
        account,
        abortSignal,
        log,
        onReady: () => {
          log?.info(`[dashboard:${account.accountId}] Gateway connected`);
          ctx.setStatus({ running: true, connected: true });
        },
        onError: (error) => {
          log?.error(`[dashboard:${account.accountId}] Gateway error: ${error.message}`);
          ctx.setStatus({ lastError: error.message });
        },
      });
    },
  },
};
```

### 2.4.4 Gateway 实现 (gateway.ts)

Gateway 负责：
1. 作为 WebSocket 客户端连接到 Dashboard Backend
2. 接收来自 Dashboard Backend 的用户消息，注入到 Openclaw
3. 将 Openclaw 的响应发送回 Dashboard Backend

```typescript
import WebSocket from "ws";
import type { ResolvedDashboardAccount } from "./types.js";
import { getDashboardRuntime } from "./runtime.js";

export interface GatewayOptions {
  account: ResolvedDashboardAccount;
  abortSignal: AbortSignal;
  log?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  onReady: () => void;
  onError: (error: Error) => void;
}

export async function startGateway(options: GatewayOptions): Promise<void> {
  const { account, abortSignal, log, onReady, onError } = options;
  const runtime = getDashboardRuntime();

  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (abortSignal.aborted) return;

    const wsUrl = `${account.backendUrl.replace(/^http/, "ws")}/ws/plugin`;
    log?.info(`[dashboard] Connecting to ${wsUrl}`);

    ws = new WebSocket(wsUrl, {
      headers: {
        "X-Plugin-Token": account.pluginToken || "",
      },
    });

    ws.on("open", () => {
      log?.info("[dashboard] WebSocket connected");
      onReady();

      // 发送认证消息
      ws?.send(JSON.stringify({
        type: "plugin.auth",
        payload: {
          accountId: account.accountId,
          pluginVersion: "1.0.0",
        },
      }));
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleIncomingMessage(message, runtime);
      } catch (err) {
        log?.error(`[dashboard] Failed to parse message: ${err}`);
      }
    });

    ws.on("close", () => {
      log?.warn("[dashboard] WebSocket disconnected");
      if (!abortSignal.aborted) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    });

    ws.on("error", (err) => {
      log?.error(`[dashboard] WebSocket error: ${err.message}`);
      onError(err);
    });
  };

  const handleIncomingMessage = (message: any, runtime: any) => {
    // 处理来自 Dashboard Backend 的用户消息
    if (message.type === "user.message") {
      const { conversationId, content, messageId } = message.payload;

      // 注入到 Openclaw 的消息处理流程
      runtime.channel?.handleIncomingMessage?.({
        channel: "dashboard",
        to: `dashboard:conversation:${conversationId}`,
        from: "user",
        content,
        messageId,
        timestamp: Date.now(),
      });
    }
  };

  connect();

  abortSignal.addEventListener("abort", () => {
    reconnectTimer && clearTimeout(reconnectTimer);
    ws?.close();
  });
}
```

### 2.4.5 Outbound 实现 (outbound.ts)

Outbound 负责将 Openclaw 的响应发送到 Dashboard Backend：

```typescript
import WebSocket from "ws";
import type { ResolvedDashboardAccount } from "./types.js";
import { getDashboardRuntime } from "./runtime.js";

// WebSocket 连接管理
const connections = new Map<string, WebSocket>();

export function registerConnection(accountId: string, ws: WebSocket) {
  connections.set(accountId, ws);
}

export function unregisterConnection(accountId: string) {
  connections.delete(accountId);
}

export async function sendText(options: {
  to: string;
  text: string;
  account: ResolvedDashboardAccount;
}): Promise<{ messageId: string; error?: string }> {
  const { to, text, account } = options;
  const ws = connections.get(account.accountId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { messageId: "", error: "WebSocket not connected" };
  }

  // 从 to 中提取 conversationId
  const conversationId = to.replace(/^dashboard:conversation:/i, "");

  const message = {
    type: "agent.message",
    payload: {
      conversationId,
      content: text,
      timestamp: Date.now(),
    },
  };

  try {
    ws.send(JSON.stringify(message));
    return { messageId: `msg_${Date.now()}` };
  } catch (err) {
    return { messageId: "", error: String(err) };
  }
}

export async function sendStreamingText(options: {
  to: string;
  delta: string;
  done: boolean;
  account: ResolvedDashboardAccount;
}): Promise<void> {
  const { to, delta, done, account } = options;
  const ws = connections.get(account.accountId);

  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const conversationId = to.replace(/^dashboard:conversation:/i, "");

  const message = {
    type: done ? "agent.message.done" : "agent.message.streaming",
    payload: {
      conversationId,
      delta,
      timestamp: Date.now(),
    },
  };

  ws.send(JSON.stringify(message));
}

export async function sendMedia(options: {
  to: string;
  text?: string;
  mediaUrl: string;
  account: ResolvedDashboardAccount;
}): Promise<{ messageId: string; error?: string }> {
  const { to, text, mediaUrl, account } = options;
  const ws = connections.get(account.accountId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { messageId: "", error: "WebSocket not connected" };
  }

  const conversationId = to.replace(/^dashboard:conversation:/i, "");

  const message = {
    type: "agent.media",
    payload: {
      conversationId,
      text,
      mediaUrl,
      timestamp: Date.now(),
    },
  };

  try {
    ws.send(JSON.stringify(message));
    return { messageId: `msg_${Date.now()}` };
  } catch (err) {
    return { messageId: "", error: String(err) };
  }
}
```

### 2.4.6 类型定义 (types.ts)

```typescript
export interface DashboardAccountConfig {
  enabled?: boolean;
  name?: string;
  backendUrl?: string;       // Dashboard Backend 的地址，如 http://localhost:3001
  pluginToken?: string;      // 用于认证的 token
}

export interface ResolvedDashboardAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  backendUrl: string;
  pluginToken?: string;
  config: DashboardAccountConfig;
}
```

### 2.4.7 配置示例

在 Openclaw 的配置文件中添加 Dashboard channel：

```yaml
# openclaw.yaml
channels:
  dashboard:
    enabled: true
    backendUrl: "http://your-dashboard-server:3001"
    pluginToken: "your-secure-token"
    name: "My Dashboard"
```

安装插件：
```bash
openclaw plugins install @your-org/dashboard-plugin
openclaw channels add dashboard --backend-url http://your-dashboard-server:3001 --plugin-token your-secure-token
```

---

## 2.5 任务协议 (Task Protocol)

任务协议是 Agent 与 Dashboard 之间用于任务状态通信的轻量级协议。Agent 通过在输出中嵌入特定的内联标记，Dashboard 后端解析这些标记来追踪任务状态。

### 2.5.1 协议格式

采用**简单的内联标记**，避免复杂的 JSON 格式：

| 标记 | 格式 | 描述 |
|------|------|------|
| **开始** | `[TASK:START:type:title]` | 开始一个新任务 |
| **进度** | `[TASK:PROGRESS:percent]` | 更新任务进度 |
| **进度消息** | `[TASK:PROGRESS:percent:message]` | 更新进度并附带消息 |
| **完成** | `[TASK:DONE]` | 任务成功完成 |
| **失败** | `[TASK:FAILED:message]` | 任务失败 |

**任务类型 (type)：**
- `research` - 搜索/调研任务
- `code` - 代码生成/修改任务
- `file` - 文件处理任务
- `command` - 命令执行任务
- `custom` - 自定义任务

### 2.5.2 使用示例

**简单任务（无进度）：**
```
我帮你创建这个文件。

[TASK:START:file:创建配置文件]

好的，文件已创建完成。

[TASK:DONE]
```

**带进度的任务：**
```
我来帮你调研这个问题。

[TASK:START:research:调研 AI Agent 发展历史]

正在搜索相关资料...
[TASK:PROGRESS:20:搜索中]

已找到 5 篇相关文章...
[TASK:PROGRESS:40:阅读文章]

正在整理关键信息...
[TASK:PROGRESS:70:整理中]

生成调研报告中...
[TASK:PROGRESS:90:生成报告]

## AI Agent 发展历史

### 1. 早期阶段 (2020-2022)
早期的 AI Agent 主要基于规则引擎...

### 2. 发展阶段 (2022-2024)
随着 LLM 的兴起，Agent 开始具备...

[TASK:DONE]
```

**失败任务：**
```
我来执行这个命令。

[TASK:START:command:安装依赖]

执行 npm install...

[TASK:FAILED:网络连接失败，请检查网络设置]
```

### 2.5.3 后端解析逻辑

Dashboard Backend 使用正则表达式解析任务标记：

```typescript
// 任务标记正则
const TASK_START_REGEX = /\[TASK:START:(\w+):([^\]]+)\]/;
const TASK_PROGRESS_REGEX = /\[TASK:PROGRESS:(\d+)(?::([^\]]+))?\]/;
const TASK_DONE_REGEX = /\[TASK:DONE\]/;
const TASK_FAILED_REGEX = /\[TASK:FAILED:([^\]]+)\]/;

class MessageParser {
  parse(content: string): ParseResult {
    const lines = content.split('\n');
    const result: ParseResult = {
      messageType: 'text',
      cleanContent: '',
    };

    for (const line of lines) {
      // 检查任务开始
      const startMatch = line.match(TASK_START_REGEX);
      if (startMatch) {
        result.messageType = 'task_start';
        result.taskInfo = {
          type: startMatch[1] as TaskType,
          title: startMatch[2],
        };
        continue; // 跳过标记行
      }

      // 检查进度更新
      const progressMatch = line.match(TASK_PROGRESS_REGEX);
      if (progressMatch) {
        result.messageType = 'task_update';
        result.taskInfo = {
          progress: parseInt(progressMatch[1]),
          message: progressMatch[2],
        };
        continue;
      }

      // 检查任务完成
      if (TASK_DONE_REGEX.test(line)) {
        result.messageType = 'task_end';
        result.taskInfo = { status: 'completed' };
        continue;
      }

      // 检查任务失败
      const failedMatch = line.match(TASK_FAILED_REGEX);
      if (failedMatch) {
        result.messageType = 'task_end';
        result.taskInfo = {
          status: 'failed',
          errorMessage: failedMatch[1],
        };
        continue;
      }

      // 普通内容
      result.cleanContent += line + '\n';
    }

    return result;
  }
}
```

### 2.5.4 前端展示

解析后的任务信息以**任务卡片**形式展示：

```
┌─────────────────────────────────────────────────┐
│ 🔬 Research: 调研 AI Agent 发展历史              │
│ ─────────────────────────────────────────────── │
│ ████████████████░░░░  80%                       │
│                                                 │
│ 📝 整理中...                                    │
│ ─────────────────────────────────────────────── │
│ 状态: 运行中 · 开始于 2 分钟前                   │
└─────────────────────────────────────────────────┘
```

用户点击卡片可展开**任务详情模态框**，查看完整输出。

---

## 2.6 Agent 提示词设计

为了让 Agent 正确使用任务协议，需要在系统提示词中添加相关指导。

### 2.6.1 任务协议提示词

```markdown
# 任务状态报告协议

当执行耗时较长的任务时（如搜索、代码生成、文件处理等），请使用任务标记来报告状态。

## 标记格式

- **开始任务**: `[TASK:START:type:title]`
  - type: research | code | file | command | custom
  - title: 任务简短描述

- **更新进度**: `[TASK:PROGRESS:percent:message]`
  - percent: 0-100 的进度百分比
  - message: (可选) 当前进度说明

- **完成任务**: `[TASK:DONE]`

- **任务失败**: `[TASK:FAILED:error_message]`

## 使用规则

1. 每个标记独占一行
2. 标记行不会显示给用户，会被系统解析
3. 任务开始和结束标记之间可以有任意内容
4. 进度更新是可选的，简单任务可以省略
5. 完成后必须使用 DONE 或 FAILED 标记结束任务

## 示例

```
我来帮你搜索相关信息。

[TASK:START:research:搜索 Python 异步编程资料]

正在搜索...
[TASK:PROGRESS:30:找到 10 条结果]

正在阅读最相关的文章...
[TASK:PROGRESS:60:阅读中]

以下是搜索结果：

## Python 异步编程指南
...（内容）...

[TASK:DONE]
```
```

### 2.6.2 完整系统提示词示例

```yaml
# openclaw.yaml
channels:
  dashboard:
    systemPrompt: |
      你是一个有用的 AI 助手。

      # 任务状态报告协议

      当执行耗时较长的任务时（如搜索、代码生成、文件处理等），请使用任务标记来报告状态。

      ## 标记格式

      - **开始任务**: `[TASK:START:type:title]`
        - type: research | code | file | command | custom
        - title: 任务简短描述

      - **更新进度**: `[TASK:PROGRESS:percent:message]`
        - percent: 0-100 的进度百分比
        - message: (可选) 当前进度说明

      - **完成任务**: `[TASK:DONE]`

      - **任务失败**: `[TASK:FAILED:error_message]`

      ## 使用规则

      1. 每个标记独占一行
      2. 标记行不会显示给用户，会被系统解析
      3. 任务开始和结束标记之间可以有任意内容
      4. 进度更新是可选的，简单任务可以省略
      5. 完成后必须使用 DONE 或 FAILED 标记结束任务
```

---

## 3. 技术栈

### 3.1 前端技术栈

| 技术 | 用途 |
|------|------|
| Next.js 14+ | React 框架，App Router |
| TypeScript | 类型安全 |
| Tailwind CSS | 样式 |
| Zustand | 客户端状态管理 |
| Framer Motion | 动画（任务卡片、模态框） |
| Lucide Icons | 图标库 |

### 3.2 后端技术栈

| 技术 | 用途 |
|------|------|
| Node.js 18+ | 运行时 |
| Fastify | Web 框架（比 Express 更快，原生支持 WebSocket） |
| TypeScript | 类型安全 |
| ws / @fastify/websocket | WebSocket 服务 |
| better-sqlite3 | SQLite 数据库驱动 |
| zod | 请求/响应验证 |

---

## 4. 项目结构

```
openclaw-dashboard/
├── apps/
│   ├── web/                          # Next.js 前端
│   │   ├── src/
│   │   │   ├── app/                  # App Router 页面
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx          # 主页面
│   │   │   │   └── globals.css
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.tsx       # 左侧渠道列表
│   │   │   │   │   └── MainContent.tsx   # 右侧聊天区
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatPanel.tsx     # 聊天面板
│   │   │   │   │   ├── MessageList.tsx   # 消息列表
│   │   │   │   │   ├── MessageItem.tsx   # 单条消息
│   │   │   │   │   ├── TaskCard.tsx      # 任务卡片消息
│   │   │   │   │   └── InputBar.tsx      # 输入框
│   │   │   │   ├── task/
│   │   │   │   │   └── TaskModal.tsx     # 任务详情模态框
│   │   │   │   └── common/
│   │   │   │       ├── Avatar.tsx
│   │   │   │       └── StatusBadge.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useWebSocket.ts       # WebSocket 连接
│   │   │   │   └── useChat.ts            # 聊天逻辑
│   │   │   ├── stores/
│   │   │   │   ├── chatStore.ts          # 聊天状态
│   │   │   │   └── taskStore.ts          # 任务状态
│   │   │   ├── lib/
│   │   │   │   └── api.ts                # HTTP API 调用
│   │   │   └── types/
│   │   │       └── index.ts              # 类型定义
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tailwind.config.js
│   │
│   └── server/                        # Node.js 后端
│       ├── src/
│       │   ├── index.ts               # 入口
│       │   ├── app.ts                 # Fastify 应用
│       │   ├── routes/
│       │   │   ├── websocket.ts       # WebSocket 路由
│       │   │   ├── messages.ts        # 消息 API
│       │   │   ├── tasks.ts           # 任务 API
│       │   │   └── channels.ts        # 渠道 API
│       │   ├── services/
│       │   │   ├── openclaw.ts        # Openclaw 连接服务
│       │   │   ├── messageParser.ts   # 消息解析器
│       │   │   └── taskManager.ts     # 任务管理器
│       │   ├── db/
│       │   │   ├── index.ts           # 数据库连接
│       │   │   ├── schema.sql         # 表结构
│       │   │   └── migrations/        # 迁移脚本
│       │   └── types/
│       │       └── index.ts           # 类型定义
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                          # 共享包（可选）
│   └── shared/
│       └── types/                     # 前后端共享类型
│           └── index.ts
│
├── package.json                       # Monorepo 根配置
├── pnpm-workspace.yaml               # pnpm workspace
└── README.md
```

---

## 5. 数据模型

### 5.1 数据库 Schema (SQLite)

```sql
-- 会话表：存储聊天会话（类似 ChatGPT 的对话）
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,              -- UUID，格式: conv_xxx
    title TEXT,                       -- 会话标题（自动生成或用户自定义）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消息表：存储所有消息
CREATE TABLE messages (
    id TEXT PRIMARY KEY,              -- UUID，格式: msg_xxx
    conversation_id TEXT NOT NULL,    -- 所属会话
    role TEXT NOT NULL,               -- 'user' | 'assistant'
    content TEXT NOT NULL,            -- 消息内容
    message_type TEXT DEFAULT 'text', -- 'text' | 'task_start' | 'task_update' | 'task_end'
    task_id TEXT,                     -- 关联的任务 ID（如果消息属于任务）
    metadata TEXT,                    -- JSON 格式的元数据
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 任务表：存储任务信息
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,              -- UUID，格式: task_xxx
    conversation_id TEXT NOT NULL,    -- 所属会话
    type TEXT NOT NULL,               -- 任务类型：research, code, file, command, custom
    title TEXT,                       -- 任务标题
    status TEXT DEFAULT 'pending',    -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress INTEGER DEFAULT 0,       -- 进度 0-100
    progress_message TEXT,            -- 当前进度消息
    error_message TEXT,               -- 错误信息（如果失败）
    started_at DATETIME,              -- 开始时间
    completed_at DATETIME,            -- 完成时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- 任务输出表：存储任务的详细输出内容
CREATE TABLE task_outputs (
    id TEXT PRIMARY KEY,              -- UUID
    task_id TEXT NOT NULL,            -- 所属任务
    sequence INTEGER DEFAULT 0,       -- 输出顺序
    type TEXT NOT NULL,               -- 'text' | 'code' | 'image' | 'file' | 'link'
    content TEXT,                     -- 输出内容
    metadata TEXT,                    -- JSON 格式的元数据（如代码语言、文件名等）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 索引
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_task ON messages(task_id);
CREATE INDEX idx_tasks_conversation ON tasks(conversation_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_outputs_task ON task_outputs(task_id);
```

### 5.2 TypeScript 类型定义

```typescript
// 会话
interface Conversation {
  id: string;                    // 格式: conv_xxx
  title?: string;                // 会话标题
  createdAt: Date;
  updatedAt: Date;
}

// 消息
type MessageRole = 'user' | 'assistant';
type MessageType = 'text' | 'task_start' | 'task_update' | 'task_end';

interface Message {
  id: string;                    // 格式: msg_xxx
  conversationId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  taskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// 任务
type TaskType = 'research' | 'code' | 'file' | 'command' | 'custom';
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface Task {
  id: string;                    // 格式: task_xxx
  conversationId: string;
  type: TaskType;
  title?: string;
  status: TaskStatus;
  progress: number;              // 0-100
  progressMessage?: string;      // 当前进度消息
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

// 任务输出
type TaskOutputType = 'text' | 'code' | 'image' | 'file' | 'link';

interface TaskOutput {
  id: string;
  taskId: string;
  sequence: number;
  type: TaskOutputType;
  content: string;
  metadata?: {
    language?: string;      // 代码语言
    filename?: string;      // 文件名
    url?: string;           // 链接地址
  };
  createdAt: Date;
}
```

---

## 6. API 设计

### 6.1 HTTP REST API

**基础路径**: `/api/v1`

#### 会话接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/conversations` | 获取会话列表 |
| POST | `/conversations` | 创建新会话 |
| GET | `/conversations/:id` | 获取会话详情 |
| PUT | `/conversations/:id` | 更新会话（如标题） |
| DELETE | `/conversations/:id` | 删除会话 |

#### 消息接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/conversations/:id/messages` | 获取会话消息列表（分页） |
| POST | `/conversations/:id/messages` | 发送消息（HTTP 方式，备用） |

#### 任务接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/tasks/:id` | 获取任务详情 |
| GET | `/tasks/:id/outputs` | 获取任务输出列表 |
| POST | `/tasks/:id/cancel` | 取消任务 |
| GET | `/conversations/:id/tasks` | 获取会话的所有任务 |

### 6.2 WebSocket 协议

**前端连接地址**: `ws://localhost:3001/ws`
**插件连接地址**: `ws://localhost:3001/ws/plugin`

#### 消息格式

```typescript
interface WSMessage {
  type: string;           // 消息类型
  payload: unknown;       // 消息载荷
  requestId?: string;     // 请求 ID（用于响应匹配）
}
```

#### 前端 → 服务端 消息类型

| type | payload | 描述 |
|------|---------|------|
| `chat.send` | `{ conversationId, content }` | 发送聊天消息 |
| `task.cancel` | `{ taskId }` | 取消任务 |
| `conversation.create` | `{ title? }` | 创建新会话 |
| `conversation.switch` | `{ conversationId }` | 切换当前会话 |
| `ping` | `{}` | 心跳 |

#### 插件 → 服务端 消息类型

| type | payload | 描述 |
|------|---------|------|
| `plugin.auth` | `{ accountId, pluginVersion }` | 插件认证 |
| `agent.message` | `{ conversationId, content }` | Agent 完整消息 |
| `agent.message.streaming` | `{ conversationId, delta }` | Agent 流式输出 |
| `agent.message.done` | `{ conversationId }` | Agent 消息完成 |
| `agent.media` | `{ conversationId, text?, mediaUrl }` | Agent 发送媒体 |

#### 服务端 → 前端 消息类型

| type | payload | 描述 |
|------|---------|------|
| `chat.message` | `Message` | 新消息（用户或助手） |
| `chat.streaming` | `{ messageId, delta, done }` | 流式响应片段 |
| `task.created` | `Task` | 任务创建 |
| `task.updated` | `{ taskId, status, progress, message? }` | 任务状态更新 |
| `task.output` | `TaskOutput` | 任务输出内容 |
| `task.completed` | `Task` | 任务完成 |
| `task.failed` | `{ taskId, error }` | 任务失败 |
| `conversation.created` | `Conversation` | 会话创建成功 |
| `history.messages` | `Message[]` | 历史消息加载 |
| `error` | `{ code, message }` | 错误信息 |
| `pong` | `{}` | 心跳响应 |

#### 服务端 → 插件 消息类型

| type | payload | 描述 |
|------|---------|------|
| `user.message` | `{ conversationId, content, messageId }` | 用户消息 |
| `plugin.auth.success` | `{}` | 认证成功 |
| `plugin.auth.failed` | `{ reason }` | 认证失败 |

---

## 7. 核心组件设计

### 7.1 后端核心服务

#### PluginConnectionManager - 插件连接管理

Dashboard Backend 作为 WebSocket 服务端，接收来自 Dashboard Plugin 的连接。

```typescript
class PluginConnectionManager {
  private connections: Map<string, WebSocket> = new Map();

  // 注册新连接
  register(accountId: string, ws: WebSocket): void;

  // 移除连接
  unregister(accountId: string): void;

  // 发送消息到插件
  send(accountId: string, message: WSMessage): void;

  // 广播到所有连接
  broadcast(message: WSMessage): void;

  // 检查连接状态
  isConnected(accountId: string): boolean;
}
```

#### MessageParser - 消息解析器

解析 Agent 消息中的任务标记。

```typescript
interface ParseResult {
  messageType: 'text' | 'task_start' | 'task_update' | 'task_end';
  taskInfo?: {
    type: TaskType;
    title?: string;
    status?: 'completed' | 'failed';
    progress?: number;
    message?: string;
    errorMessage?: string;
  };
  cleanContent: string;  // 移除标记后的内容
}

class MessageParser {
  // 任务标记正则
  private static readonly TASK_START_REGEX = /\[TASK:START:(\w+):([^\]]+)\]/;
  private static readonly TASK_PROGRESS_REGEX = /\[TASK:PROGRESS:(\d+)(?::([^\]]+))?\]/;
  private static readonly TASK_DONE_REGEX = /\[TASK:DONE\]/;
  private static readonly TASK_FAILED_REGEX = /\[TASK:FAILED:([^\]]+)\]/;

  parse(content: string): ParseResult;
}
```

#### TaskManager - 任务管理器

```typescript
class TaskManager {
  private activeTasks: Map<string, Task> = new Map();

  create(conversationId: string, type: TaskType, title?: string): Task;
  updateStatus(taskId: string, status: TaskStatus, progress?: number): void;
  addOutput(taskId: string, output: Omit<TaskOutput, 'id' | 'taskId'>): TaskOutput;
  complete(taskId: string): void;
  fail(taskId: string, error: string): void;
  cancel(taskId: string): void;
  get(taskId: string): Task | undefined;
  getActiveByConversation(conversationId: string): Task[];
}
```

### 7.2 前端核心组件

#### 组件层级结构

```
page.tsx (主页面)
└── MainLayout
    ├── Sidebar (左侧会话列表)
    │   ├── NewChatButton
    │   └── ConversationList
    │       └── ConversationItem
    │
    └── MainContent (右侧聊天区)
        ├── ChatHeader (会话标题)
        ├── ChatPanel (聊天面板)
        │   └── MessageList
        │       ├── MessageItem (普通消息)
        │       ├── StreamingMessage (流式输出)
        │       ├── TaskCard (任务卡片)
        │       └── DateDivider (日期分隔)
        └── InputBar (输入框)
```

#### TaskCard 组件设计

```
┌─────────────────────────────────────────────────┐
│ 🔬 Research: AI Agent 发展历史                   │
│ ─────────────────────────────────────────────── │
│ ████████████░░░░░░░░  65%                       │
│                                                 │
│ 📄 已收集 3 条资料...                           │
│ ─────────────────────────────────────────────── │
│ 状态: 运行中 · 开始于 2 分钟前                   │
└─────────────────────────────────────────────────┘
```

#### TaskModal 组件设计

```
┌─────────────────────────────────────────────────────────────┐
│ ×  Research: AI Agent 发展历史                              │
│─────────────────────────────────────────────────────────────│
│                                                             │
│ 状态: ✅ 已完成 · 耗时 3 分 20 秒                            │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 输出内容                                                 │ │
│ │                                                         │ │
│ │ ## 1. 早期阶段 (2020-2022)                               │ │
│ │ 早期的 AI Agent 主要基于规则引擎...                      │ │
│ │                                                         │ │
│ │ ## 2. 发展阶段 (2022-2024)                               │ │
│ │ 随着 LLM 的兴起，Agent 开始具备...                       │ │
│ │                                                         │ │
│ │ ## 3. 当前趋势 (2024-至今)                               │ │
│ │ 多 Agent 协作成为主流...                                 │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ [复制全部] [导出为 Markdown] [取消任务(运行时可见)]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 实现路线图

### 8.1 开发阶段划分

```
Phase 1: 基础框架
├── 项目初始化 (monorepo 结构)
├── Dashboard Backend 基础
│   ├── Fastify 服务
│   ├── SQLite 数据库
│   └── REST API (会话、消息)
├── Dashboard Frontend 基础
│   ├── Next.js 项目
│   └── 基础布局组件
└── WebSocket 连接 (前端 ↔ 后端)

Phase 2: Dashboard Plugin
├── 插件项目结构
├── Channel 插件实现
├── Gateway (WebSocket 客户端)
├── Outbound (发送消息)
└── 插件测试与调试

Phase 3: 核心功能
├── 消息收发 (聊天功能)
├── 流式输出支持
├── 消息解析器 (任务标记)
└── 任务管理器

Phase 4: 任务系统
├── TaskCard 组件
├── TaskModal 组件
├── 任务状态实时更新
└── 任务输出展示

Phase 5: 完善优化
├── 历史消息加载
├── 错误处理与重连
├── UI 细节优化
└── 测试与文档
```
└── 任务管理器

Phase 3: 任务系统 (Week 3)
├── 任务卡片组件
├── 任务模态框
├── 任务状态实时更新
└── 任务输出展示

Phase 4: 完善优化 (Week 4)
├── 历史消息加载
├── 错误处理与重连
├── UI 细节优化
└── 测试与文档
```

### 8.2 详细任务清单

#### Phase 1: 基础框架

| 任务 | 描述 | 产出 |
|------|------|------|
| 1.1 项目初始化 | 创建 monorepo 结构，配置 pnpm workspace | 项目骨架 |
| 1.2 后端基础 | Fastify 服务、SQLite 连接、基础目录结构 | 可运行的后端 |
| 1.3 数据库 Schema | 创建所有表和索引 | schema.sql |
| 1.4 REST API 基础 | 渠道、会话、消息 CRUD 接口 | API 路由 |
| 1.5 前端基础 | Next.js 项目、Tailwind 配置、基础布局 | 可访问的前端 |
| 1.6 WebSocket 服务 | 后端 WebSocket 服务端、前端连接客户端 | 双向通信 |

#### Phase 2: 核心功能

| 任务 | 描述 | 产出 |
|------|------|------|
| 2.1 Openclaw 连接 | 后端连接 Openclaw Gateway | OpenclawClient 服务 |
| 2.2 消息发送 | 前端 → 后端 → Openclaw | chat.send 流程 |
| 2.3 消息接收 | Openclaw → 后端 → 前端 | chat.message 推送 |
| 2.4 消息解析器 | 识别任务类型、提取进度 | MessageParser 服务 |
| 2.5 任务管理器 | 任务创建、状态更新、持久化 | TaskManager 服务 |
| 2.6 聊天 UI | MessageList、InputBar 组件 | 完整聊天界面 |

#### Phase 3: 任务系统

| 任务 | 描述 | 产出 |
|------|------|------|
| 3.1 TaskCard 组件 | 任务卡片消息，显示状态和进度 | 任务卡片 UI |
| 3.2 TaskModal 组件 | 任务详情模态框，展示完整输出 | 任务详情弹窗 |
| 3.3 任务状态订阅 | 前端订阅任务更新，实时刷新 UI | 状态同步机制 |
| 3.4 任务输出存储 | 分段存储任务输出内容 | task_outputs 表写入 |
| 3.5 任务 API | 获取任务详情、输出列表、取消任务 | 任务相关 REST API |

#### Phase 4: 完善优化

| 任务 | 描述 | 产出 |
|------|------|------|
| 4.1 历史加载 | 页面加载时获取历史消息和任务 | 历史数据 API |
| 4.2 断线重连 | WebSocket 断开自动重连，状态恢复 | 重连机制 |
| 4.3 错误处理 | 友好的错误提示，重试机制 | 错误边界组件 |
| 4.4 UI 优化 | 动画、响应式、暗色模式 | 精致的 UI |
| 4.5 测试 | 单元测试、集成测试 | 测试用例 |
| 4.6 文档 | README、API 文档、部署指南 | 项目文档 |

---

## 9. 配置示例

### 9.1 后端配置

```typescript
// apps/server/src/config.ts
export const config = {
  server: {
    port: 3001,
    host: '0.0.0.0',  // 允许外部访问
  },
  plugin: {
    token: process.env.PLUGIN_TOKEN || 'your-secure-token',  // 插件认证 token
  },
  database: {
    path: './data/dashboard.db',
  },
};
```

### 9.2 前端配置

```typescript
// apps/web/src/lib/config.ts
export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
  reconnectInterval: 3000,
};
```

### 9.3 Openclaw 配置

```yaml
# openclaw.yaml (在 Openclaw 服务器上)
channels:
  dashboard:
    enabled: true
    backendUrl: "http://your-dashboard-server:3001"
    pluginToken: "your-secure-token"  # 与后端配置一致
    name: "Dashboard"
    systemPrompt: |
      你是一个有用的 AI 助手。

      # 任务状态报告协议

      当执行耗时较长的任务时，使用任务标记报告状态：
      - 开始: [TASK:START:type:title]
      - 进度: [TASK:PROGRESS:percent:message]
      - 完成: [TASK:DONE]
      - 失败: [TASK:FAILED:message]
```

---

## 10. 依赖清单

### 10.1 前端依赖

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.2.0"
  }
}
```

### 10.2 后端依赖

```json
{
  "dependencies": {
    "fastify": "^4.26.0",
    "@fastify/websocket": "^10.0.0",
    "ws": "^8.16.0",
    "better-sqlite3": "^9.4.0",
    "zod": "^3.22.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/ws": "^8.5.0",
    "@types/uuid": "^9.0.0"
  }
}
```

### 10.3 Dashboard 插件依赖

```json
{
  "dependencies": {
    "ws": "^8.16.0"
  },
  "peerDependencies": {
    "openclaw": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/ws": "^8.5.0"
  }
}
```

---

## 11. 设计总结

| 维度 | 决策 |
|------|------|
| **用途** | 个人使用的 Web 聊天界面（类似 ChatGPT） |
| **架构** | 插件模式（Frontend ↔ Backend ↔ Plugin ↔ Openclaw） |
| **前端** | Next.js 14 + TypeScript + Tailwind + Zustand |
| **后端** | Node.js + Fastify + WebSocket + SQLite |
| **插件** | Openclaw Channel Plugin (TypeScript) |
| **通信** | WebSocket（前端-后端、插件-后端） |
| **任务协议** | 内联标记（`[TASK:START:type:title]` 等） |
| **流式输出** | 支持，通过 WebSocket 实时推送 |
| **布局** | 左侧会话列表 + 右侧聊天区（类 ChatGPT） |
| **任务类型** | Research、代码、文件处理、命令、自定义 |

---

## 12. 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       Server A (Openclaw)                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Openclaw Gateway                      │   │
│   │                         ↓                                │   │
│   │              Dashboard Plugin (已安装)                   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                         WebSocket (Internet)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Server B (Dashboard)                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 Dashboard Backend                        │   │
│   │               (Fastify + WebSocket)                      │   │
│   │                         ↓                                │   │
│   │                      SQLite                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 Dashboard Frontend                       │   │
│   │                   (Next.js)                              │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                           Browser
```
