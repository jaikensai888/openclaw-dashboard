# OpenClaw Dashboard 远程连接设计文档

> 创建日期：2025-03-26
> 状态：待实现

## 1. 项目背景

OpenClaw Dashboard 需要支持远程连接能力，实现：
- Dashboard 与 OpenClaw Gateway 分离部署
- 支持同时连接多个远程服务器
- 访问远程服务器上的 Agent 工作目录
- 实时查看远程文件内容

## 2. 整体架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              服务器 A (Dashboard)                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Dashboard Server                              │  │
│  │                                                                        │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │              Remote Connection Manager                          │   │  │
│  │  │                                                                 │   │  │
│  │  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │  │
│  │  │   │ SSH Tunnel  │  │ SSH Tunnel  │  │ SSH Tunnel  │            │   │  │
│  │  │   │ (server-b)  │  │ (server-c)  │  │ (server-n)  │            │   │  │
│  │  │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │   │  │
│  │  │          │                │                │                   │   │  │
│  │  │   ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐            │   │  │
│  │  │   │ RemoteClient │ │ RemoteClient │ │ RemoteClient │            │   │  │
│  │  │   │ :13001       │ │ :13002       │ │ :13003       │            │   │  │
│  │  │   └──────────────┘ └──────────────┘ └──────────────┘            │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                    │                      │                      │
                    │     SSH 隧道         │                      │
                    ▼                      ▼                      ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────┐
│       服务器 B               │  │       服务器 C               │  │   服务器 N   │
│  ┌───────────────────────┐  │  │  ┌───────────────────────┐  │  │             │
│  │ dashboard-remote-     │  │  │  │ dashboard-remote-     │  │  │   ...       │
│  │ server                │  │  │  │ server                │  │  │             │
│  │ (ws://127.0.0.1:3001) │  │  │  │ (ws://127.0.0.1:3001) │  │  │             │
│  └───────────┬───────────┘  │  │  └───────────┬───────────┘  │  │             │
│              │              │  │              │              │  │             │
│   ┌──────────┴──────────┐   │  │   ┌──────────┴──────────┐   │  │             │
│   │ OpenClaw Gateway    │   │  │   │ OpenClaw Gateway    │   │  │             │
│   │ + Agent 工作目录     │   │  │   │ + Agent 工作目录     │   │  │             │
│   └─────────────────────┘   │  │   └─────────────────────┘   │  │             │
└─────────────────────────────┘  └─────────────────────────────┘  └─────────────┘
```

### 2.2 核心组件

| 组件 | 位置 | 职责 |
|------|------|------|
| **Dashboard Server** | 服务器 A | 现有后端服务，新增远程连接管理模块 |
| **Remote Connection Manager** | Dashboard Server | 管理 SSH 隧道、JSON-RPC 客户端、服务器切换 |
| **dashboard-remote-server** | 服务器 B/C/N | Sidecar 服务，桥接 Gateway 和文件系统 |
| **Gateway Bridge** | remote-server | 连接本地 Gateway，转发 Agent 请求 |
| **File System Manager** | remote-server | 文件操作、目录遍历、权限检查 |

### 2.3 通信协议

| 连接 | 协议 | 说明 |
|------|------|------|
| Dashboard ↔ remote-server | WebSocket + JSON-RPC | 单一连接承载所有通信 |
| remote-server ↔ Gateway | WebSocket | 现有 Gateway 协议 |
| 文件传输 | Base64 编码 | 通过 JSON-RPC 传输 |

---

## 3. dashboard-remote-server 设计

### 3.1 目录结构

```
dashboard-remote-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 入口
│   ├── config.ts                   # 配置管理
│   │
│   ├── server/
│   │   └── jsonRpcServer.ts        # WebSocket + JSON-RPC 服务
│   │
│   ├── modules/
│   │   ├── gatewayBridge.ts        # Gateway 连接桥接
│   │   ├── fileSystemManager.ts    # 文件系统操作
│   │   └── watchManager.ts         # 文件监控管理
│   │
│   ├── gateway/
│   │   ├── client.ts               # Gateway WebSocket 客户端
│   │   └── protocol.ts             # Gateway 协议解析
│   │
│   ├── utils/
│   │   ├── pathUtils.ts            # 路径处理
│   │   └── auth.ts                 # 认证工具
│   │
│   └── types/
│       └── index.ts                # 类型定义
│
└── config/
    └── default.json                # 默认配置
```

### 3.2 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js 18+ | 与 Dashboard 保持一致 |
| 语言 | TypeScript | 类型安全 |
| WebSocket Server | ws | 轻量可靠 |
| JSON-RPC | vscode-jsonrpc | 微软官方库 |
| 文件监控 | chokidar | 跨平台 inotify 封装 |
| 日志 | pino | 高性能 |

### 3.3 配置设计

```typescript
interface ServerConfig {
  port: number;                    // 默认 3001

  auth: {
    enabled: boolean;
    token?: string;
  };

  gateway: {
    url: string;                   // ws://127.0.0.1:18789
    token?: string;
    autoConnect: boolean;
  };

  filesystem: {
    allowedRoots: string[];        // 允许访问的目录
    maxFileSize: number;           // 最大文件大小
  };

  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

### 3.4 JSON-RPC API 规范

```typescript
// ==================== Gateway 相关 ====================
gateway.connect(): void
gateway.disconnect(): void
gateway.runAgent(params: RunAgentParams): void
gateway.isConnected(): boolean

// Gateway 事件（服务端推送）
gateway.onAgentEvent: AgentEvent
gateway.onConnectionChange: { connected: boolean }

// ==================== 文件系统 ====================
file.read(path: string): { content: string; encoding: string }
file.write(path: string, content: string, encoding?: string): void
file.delete(path: string): void
file.stat(path: string): FileInfo
file.exists(path: string): boolean

directory.list(path: string, recursive?: boolean): FileInfo[]
directory.create(path: string): void

// ==================== 监控 ====================
watch.subscribe(path: string, options?: { recursive?: boolean }): { subscriptionId: string }
watch.unsubscribe(subscriptionId: string): void

// 监控事件（服务端推送）
watch.onEvent: { subscriptionId: string; path: string; type: 'created' | 'changed' | 'deleted' }
```

### 3.5 安全考虑

- **路径穿越防护**: 所有文件路径必须规范化并验证在 allowedRoots 范围内
- **认证**: 支持简单 Token 认证
- **文件大小限制**: 防止传输过大文件导致内存溢出
- **连接白名单**: 可配置允许连接的 Dashboard 服务器地址

---

## 4. Dashboard Server 改动

### 4.1 目录结构变更

```
apps/server/src/
├── config.ts                    # 改动：添加远程服务器配置
│
├── remote/                      # 新增目录
│   ├── index.ts                 # 导出入口
│   ├── manager.ts               # Remote Connection Manager
│   ├── sshTunnel.ts             # SSH 隧道管理
│   ├── client.ts                # JSON-RPC 客户端
│   └── types.ts                 # 类型定义
│
├── services/
│   ├── orchestrator.ts          # 改动：添加远程模式支持
│   └── ...
│
├── routes/
│   ├── websocket.ts             # 改动：添加文件操作消息处理
│   ├── remote.ts                # 新增：远程服务器管理 REST API
│   └── ...
│
└── db/
    └── schema.sql               # 改动：会话表添加 server_id 字段
```

### 4.2 数据库变更

```sql
-- 会话表添加服务器关联
ALTER TABLE conversations ADD COLUMN server_id TEXT;

-- 服务器配置表（新增）
CREATE TABLE IF NOT EXISTS remote_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  private_key_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3 配置扩展

```typescript
interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;              // SSH 端口，默认 22
  username: string;
  privateKey?: string;       // 私钥路径或内容
  remotePort: number;        // remote-server 端口，默认 3001
}

interface Config {
  // 现有配置...

  remote: {
    enabled: boolean;
    servers: RemoteServerConfig[];
  }
}
```

### 4.4 核心组件

#### 4.4.1 SSH 隧道管理器

```typescript
interface SSHTunnelStatus {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  localPort?: number;
  error?: string;
}

class SSHTunnelManager {
  createTunnel(options: SSHTunnelOptions): Promise<number>;
  closeTunnel(id: string): Promise<void>;
  getStatus(id: string): SSHTunnelStatus;
  getAllStatus(): SSHTunnelStatus[];
}
```

#### 4.4.2 JSON-RPC 客户端

```typescript
class RemoteClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Gateway 方法
  gatewayConnect(): Promise<void>;
  runAgent(params: RunAgentParams): Promise<void>;
  onGatewayEvent(handler: (event: AgentEvent) => void): () => void;

  // 文件系统方法
  readFile(path: string): Promise<FileContent>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<FileInfo[]>;

  // 监控方法
  watchSubscribe(path: string): Promise<string>;
  watchUnsubscribe(subscriptionId: string): Promise<void>;
  onWatchEvent(handler: (event: WatchEvent) => void): () => void;
}
```

#### 4.4.3 远程连接管理器

```typescript
class RemoteConnectionManager {
  initialize(config: RemoteServerConfig[]): Promise<void>;
  connect(serverId: string): Promise<void>;
  disconnect(serverId: string): Promise<void>;
  setActiveServer(serverId: string): void;
  getActiveClient(): RemoteClient | null;
  getAllServersStatus(): RemoteServer[];
}
```

### 4.5 REST API 新增

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/remote/servers | 获取所有服务器状态 |
| POST | /api/v1/remote/servers | 添加服务器配置 |
| PUT | /api/v1/remote/servers/:id | 更新服务器配置 |
| DELETE | /api/v1/remote/servers/:id | 删除服务器配置 |
| POST | /api/v1/remote/servers/:id/connect | 连接服务器 |
| POST | /api/v1/remote/servers/:id/disconnect | 断开服务器 |
| PUT | /api/v1/remote/active | 切换当前服务器 |

### 4.6 WebSocket 消息新增

| 类型 | 方向 | 说明 |
|------|------|------|
| file:read | 双向 | 读取文件内容 |
| file:write | 双向 | 写入文件 |
| directory:list | 双向 | 列出目录内容 |
| watch:subscribe | 双向 | 订阅文件监控 |
| watch:unsubscribe | 双向 | 取消订阅 |
| watch:onEvent | 服务端→客户端 | 文件变化事件 |
| remote:servers | 双向 | 服务器列表/状态 |
| remote:switch | 双向 | 切换服务器 |

---

## 5. 前端改动

### 5.1 目录结构变更

```
apps/web/src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           # 改动：服务器分组、底部管理面板
│   │   └── ArtifactsPanel.tsx    # 改动：Tab 切换、远程文件
│   │
│   ├── remote/                   # 新增目录
│   │   ├── ServerManager.tsx     # 服务器管理面板
│   │   ├── ServerForm.tsx        # 添加/编辑服务器表单
│   │   ├── FileExplorer.tsx      # 文件浏览器
│   │   ├── FilePreview.tsx       # 文件预览
│   │   └── LogViewer.tsx         # 日志查看器
│   │
│   └── conversation/
│       └── ConversationList.tsx  # 改动：按服务器分组
│
├── stores/
│   ├── chatStore.ts              # 改动：会话关联服务器
│   ├── remoteStore.ts            # 新增：远程服务器状态
│   └── fileStore.ts              # 新增：文件浏览器状态
│
└── hooks/
    ├── useRemoteServer.ts        # 新增
    ├── useFileExplorer.ts        # 新增
    └── useWebSocket.ts           # 改动：处理新消息类型
```

### 5.2 状态管理

#### 5.2.1 remoteStore

```typescript
interface RemoteServer {
  id: string;
  name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

interface RemoteState {
  servers: RemoteServer[];
  activeServerId: string | null;
  managerExpanded: boolean;

  // Actions
  loadServers: () => Promise<void>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  switchServer: (id: string) => void;
  addServer: (config: ServerConfig) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  toggleManager: () => void;
}
```

#### 5.2.2 fileStore

```typescript
interface FileState {
  currentPath: string;
  files: FileInfo[];
  selectedFile: string | null;
  fileContent: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  listDirectory: (path: string) => Promise<void>;
  readFile: (path: string) => Promise<void>;
  goBack: () => void;
  refresh: () => Promise<void>;
}
```

#### 5.2.3 chatStore 变更

```typescript
interface Conversation {
  // 现有字段...
  serverId: string | null;  // 归属服务器 ID，null 为本地
}
```

### 5.3 UI 设计

#### 5.3.1 侧边栏 - 会话分组

```
┌─────────────────────────────────┐
│  🔍 搜索        [全部 ▼]        │
│  ─────────────────────────────  │
│                                 │
│  🟢 北京生产环境            [+新]│
│    ├─ 重构用户模块...       📌  │
│    └─ API 文档编写...           │
│                                 │
│  ⚪ 上海生产环境            [+新]│
│    └─ 数据分析任务              │
│                                 │
│  🔵 本地开发                [+新]│
│    └─ 测试新功能                │
│                                 │
│  ─────────────────────────────  │
│  [服务器 ▼]                      │
│  ├─ ● 北京生产环境    [断开]    │
│  ├─ ○ 上海生产环境    [连接]    │
│  └─ + 添加服务器                 │
└─────────────────────────────────┘
```

**设计要点**：
- 颜色标记：🟢 已连接、⚪ 未连接、🔵 本地
- 每个分组下有 [+新] 按钮创建该服务器的会话
- 底部展开式服务器管理面板

#### 5.3.2 产物面板 - Tab 切换

```
┌─────────────────────────────────────┐
│  产物面板                      ✕   │
│  [本地产物] [远程文件]              │
├─────────────────────────────────────┤
│  远程文件内容：                     │
│                                     │
│  /workspace/project-a         🔄   │
│  📁 src/                            │
│  📁 logs/                           │
│  📄 config.json                     │
│  📄 output.log                      │
│                                     │
└─────────────────────────────────────┘
```

**预览模式（日志文件）**：

```
┌─────────────────────────────────────┐
│  ← 返回       🔄 刷新    ⬇ 下载    │
│  output.log                         │
├─────────────────────────────────────┤
│  10:23:01 INFO  Agent starting...  │
│  10:23:02 INFO  Connected          │
│  10:23:05 DEBUG Processing...      │
│  10:23:10 INFO  Task completed     │
│                                     │
└─────────────────────────────────────┘
```

**设计要点**：
- 单一视图 + 内部预览切换
- 日志文件有刷新按钮，不自动监控
- 未连接服务器时显示提示

#### 5.3.3 服务器管理面板

**展开状态**：

```
┌─────────────────────────────────┐
│  [服务器 ▲]                      │
│  ├─ 🟢 北京生产环境              │
│  │     192.168.1.100:22          │
│  │     [断开] [编辑]             │
│  │                               │
│  ├─ ⚪ 上海生产环境              │
│  │     192.168.2.100:22          │
│  │     [连接] [编辑] [删除]      │
│  │                               │
│  └─ [+ 添加服务器]               │
└─────────────────────────────────┘
```

**折叠状态**：

```
┌─────────────────────────────────┐
│  [服务器 ▼]                      │
│  🟢 已连接: 北京生产环境          │
└─────────────────────────────────┘
```

---

## 6. 部署方案

### 6.1 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户访问                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      服务器 A (Dashboard)                        │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Nginx           │  │ Dashboard Web   │  │ Dashboard Server│ │
│  │ (反向代理)       │  │ (Next.js)       │  │ (Fastify)       │ │
│  │ :443/:80        │  │ :3000           │  │ :3002           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  SSH 私钥: ~/.ssh/dashboard_remote_key                          │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ SSH 隧道           │ SSH 隧道           │ SSH 隧道
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   服务器 B       │  │   服务器 C       │  │   服务器 N       │
│                 │  │                 │  │                 │
│  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │
│  │OpenClaw   │  │  │  │OpenClaw   │  │  │  │OpenClaw   │  │
│  │Gateway    │  │  │  │Gateway    │  │  │  │Gateway    │  │
│  │:18789     │  │  │  │:18789     │  │  │  │:18789     │  │
│  └─────┬─────┘  │  │  └─────┬─────┘  │  │  └─────┬─────┘  │
│        │        │  │        │        │  │        │        │
│  ┌─────┴─────┐  │  │  ┌─────┴─────┐  │  │  ┌─────┴─────┐  │
│  │ dashboard │  │  │  │ dashboard │  │  │  │ dashboard │  │
│  │ -remote   │  │  │  │ -remote   │  │  │  │ -remote   │  │
│  │ :3001     │  │  │  │ :3001     │  │  │  │ :3001     │  │
│  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 6.2 服务器 B/C/N 部署

#### 安装

```bash
# npm 全局安装
npm install -g @openclaw/dashboard-remote-server
```

#### 配置文件

```json
// /etc/dashboard-remote-server/config.json
{
  "port": 3001,
  "auth": {
    "enabled": true,
    "token": "${AUTH_TOKEN}"
  },
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "${GATEWAY_TOKEN}",
    "autoConnect": true
  },
  "filesystem": {
    "allowedRoots": [
      "/home/openclaw/workspace",
      "/home/openclaw/logs",
      "/home/openclaw/.openclaw"
    ],
    "maxFileSize": 10485760
  },
  "logging": {
    "level": "info"
  }
}
```

#### Systemd 服务

```ini
# /etc/systemd/system/dashboard-remote-server.service
[Unit]
Description=Dashboard Remote Server
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/dashboard-remote-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=AUTH_TOKEN=your-token-here
Environment=GATEWAY_TOKEN=your-gateway-token

[Install]
WantedBy=multi-user.target
```

### 6.3 服务器 A 部署

#### SSH 密钥配置

```bash
# 生成专用密钥
ssh-keygen -t ed25519 -C "dashboard-remote" -f ~/.ssh/dashboard_remote_key

# 复制公钥到远程服务器
ssh-copy-id -i ~/.ssh/dashboard_remote_key.pub openclaw@server-b
```

#### Dashboard Server 配置

```env
# .env
REMOTE_ENABLED=true
```

### 6.4 启动顺序

```
1. 服务器 B/C/N
   ├── 启动 OpenClaw Gateway
   └── 启动 dashboard-remote-server

2. 服务器 A
   ├── 启动 Dashboard Server
   │   └── 自动建立 SSH 隧道到各远程服务器
   └── 启动 Dashboard Web
```

### 6.5 网络要求

| 方向 | 端口 | 协议 | 说明 |
|------|------|------|------|
| A → B/C/N | 22 | SSH | 建立 SSH 隧道 |
| A 本地 | 13001+ | WebSocket | 隧道映射的本地端口 |
| B/C/N 内部 | 3001 | WebSocket | remote-server 监听 |
| B/C/N 内部 | 18789 | WebSocket | Gateway 监听 |

### 6.6 安全加固建议

| 措施 | 说明 |
|------|------|
| SSH 专用密钥 | 为 Dashboard 生成独立的 SSH 密钥 |
| Token 认证 | remote-server 启用 Token 认证 |
| 限制 SSH 用户权限 | openclaw 用户只允许端口转发 |
| allowedRoots 白名单 | 只允许访问指定目录 |
| 日志审计 | 记录所有文件操作和 Agent 请求 |

---

## 7. 实现计划

待制定（需要调用 writing-plans skill 生成详细实现计划）

---

## 8. 附录

### 8.1 设计决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 网络层 | SSH 隧道 | 复用现有 SSH 认证，无需额外配置 |
| 通信协议 | WebSocket + JSON-RPC | 参考 VS Code Remote，单一连接 |
| 会话组织 | 按服务器分组 + 当前高亮 | 清晰区分不同环境的会话 |
| 服务器管理 | 展开式面板 | 直接在侧边栏操作 |
| 产物面板 | Tab 切换 | 保留本地产物，新增远程文件 |
| 文件预览 | 单一视图切换 | 简洁，不分割面板 |
| 日志监控 | 刷新按钮 | 简化实现，按需更新 |
| 新建会话 | 分组下直接创建 | 自动归属，无额外步骤 |
| 分组视觉 | 颜色标记 | 清晰区分服务器状态 |

### 8.2 参考资料

- [VS Code Server Documentation](https://code.visualstudio.com/docs/remote/vscode-server)
- [vscode-jsonrpc npm package](https://www.npmjs.com/package/vscode-jsonrpc)
- [Theia IDE - Communication via RPC](https://theia-ide.org/docs/comms_via_rpc/)
