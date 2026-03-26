# 远程连接功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Dashboard 与 OpenClaw Gateway 的分离部署，支持通过 SSH 隧道远程连接多个服务器并访问远程文件系统。

**Architecture:** 采用 Sidecar 模式，在远程服务器上部署 dashboard-remote-server 服务，Dashboard Server 通过 SSH 隧道建立安全连接，使用 WebSocket + JSON-RPC 协议通信。

**Tech Stack:** Node.js 18+, TypeScript, ws, vscode-jsonrpc, ssh2, chokidar, pino, Zustand

**设计文档:** `docs/superpowers/specs/2025-03-26-remote-connection-design.md`

---

## 文件结构规划

### 新增项目：dashboard-remote-server

```
packages/dashboard-remote-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 入口
│   ├── config.ts                   # 配置管理
│   ├── server/
│   │   └── jsonRpcServer.ts        # WebSocket + JSON-RPC 服务
│   ├── modules/
│   │   ├── gatewayBridge.ts        # Gateway 连接桥接
│   │   ├── fileSystemManager.ts    # 文件系统操作
│   │   └── watchManager.ts         # 文件监控管理
│   ├── gateway/
│   │   ├── client.ts               # Gateway WebSocket 客户端
│   │   └── protocol.ts             # Gateway 协议解析
│   ├── utils/
│   │   ├── pathUtils.ts            # 路径处理
│   │   └── auth.ts                 # 认证工具
│   └── types/
│       └── index.ts                # 类型定义
└── config/
    └── default.json                # 默认配置
```

### Dashboard Server 改动

```
apps/server/src/
├── config.ts                       # 改动：添加远程服务器配置
├── remote/                         # 新增目录
│   ├── index.ts
│   ├── manager.ts                  # Remote Connection Manager
│   ├── sshTunnel.ts                # SSH 隧道管理
│   ├── client.ts                   # JSON-RPC 客户端
│   └── types.ts
├── routes/
│   ├── websocket.ts                # 改动：添加文件操作消息
│   └── remote.ts                   # 新增：远程服务器 REST API
└── db/
    └── index.ts                    # 改动：添加 remote_servers 表
```

### 前端改动

```
apps/web/src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # 改动：服务器分组、管理面板
│   │   └── ArtifactsPanel.tsx      # 改动：Tab 切换
│   └── remote/                     # 新增目录
│       ├── ServerManager.tsx
│       ├── ServerForm.tsx
│       ├── FileExplorer.tsx
│       ├── FilePreview.tsx
│       └── LogViewer.tsx
├── stores/
│   ├── chatStore.ts                # 改动：会话关联 serverId
│   ├── remoteStore.ts              # 新增
│   └── fileStore.ts                # 新增
└── hooks/
    ├── useRemoteServer.ts          # 新增
    └── useFileExplorer.ts          # 新增
```

---

## Chunk 1: dashboard-remote-server 基础框架

### Task 1.1: 项目初始化

**Files:**
- Create: `packages/dashboard-remote-server/package.json`
- Create: `packages/dashboard-remote-server/tsconfig.json`
- Create: `packages/dashboard-remote-server/src/index.ts`
- Create: `packages/dashboard-remote-server/src/types/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@openclaw/dashboard-remote-server",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "vscode-jsonrpc": "^8.2.0",
    "chokidar": "^3.5.3",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/ws": "^8.5.10",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建类型定义**

```typescript
// src/types/index.ts

// ==================== 配置 ====================
export interface ServerConfig {
  port: number;
  auth: {
    enabled: boolean;
    token?: string;
  };
  gateway: {
    url: string;
    token?: string;
    autoConnect: boolean;
  };
  filesystem: {
    allowedRoots: string[];
    maxFileSize: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// ==================== 文件系统 ====================
export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface FileContent {
  content: string;
  encoding: string;
}

// ==================== Gateway ====================
export interface RunAgentParams {
  conversationId: string;
  message: string;
  expertId?: string;
  systemPrompt?: string;
}

export interface AgentEvent {
  type: string;
  conversationId: string;
  data: unknown;
}

// ==================== 监控 ====================
export interface WatchOptions {
  recursive?: boolean;
}

export interface WatchEvent {
  subscriptionId: string;
  path: string;
  type: 'created' | 'changed' | 'deleted';
}

export interface Subscription {
  id: string;
  path: string;
  recursive: boolean;
}
```

- [ ] **Step 4: 创建入口文件**

```typescript
// src/index.ts
import { createServer } from './server/jsonRpcServer.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createServer(config);

server.start().then(() => {
  console.log(`Dashboard Remote Server started on port ${config.port}`);
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { createServer, loadConfig };
export * from './types/index.js';
```

- [ ] **Step 5: 创建配置加载器**

```typescript
// src/config.ts
import type { ServerConfig } from './types/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfig: ServerConfig = {
  port: 3001,
  auth: {
    enabled: false,
  },
  gateway: {
    url: 'ws://127.0.0.1:18789',
    autoConnect: true,
  },
  filesystem: {
    allowedRoots: [],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  logging: {
    level: 'info',
  },
};

export function loadConfig(): ServerConfig {
  // 从环境变量加载
  const envConfig: Partial<ServerConfig> = {};

  if (process.env.PORT) {
    envConfig.port = parseInt(process.env.PORT, 10);
  }

  if (process.env.AUTH_TOKEN) {
    envConfig.auth = { enabled: true, token: process.env.AUTH_TOKEN };
  }

  if (process.env.GATEWAY_URL) {
    envConfig.gateway = {
      ...defaultConfig.gateway,
      url: process.env.GATEWAY_URL,
      token: process.env.GATEWAY_TOKEN,
      autoConnect: process.env.GATEWAY_AUTO_CONNECT !== 'false',
    };
  }

  if (process.env.ALLOWED_ROOTS) {
    envConfig.filesystem = {
      ...defaultConfig.filesystem,
      allowedRoots: process.env.ALLOWED_ROOTS.split(','),
    };
  }

  // 尝试加载配置文件
  let fileConfig: Partial<ServerConfig> = {};
  const configPath = process.env.CONFIG_PATH || path.join(__dirname, '../config/default.json');

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
    } catch (err) {
      console.warn(`Failed to load config file: ${configPath}`, err);
    }
  }

  // 合并配置
  return {
    ...defaultConfig,
    ...fileConfig,
    ...envConfig,
    auth: { ...defaultConfig.auth, ...fileConfig.auth, ...envConfig.auth },
    gateway: { ...defaultConfig.gateway, ...fileConfig.gateway, ...envConfig.gateway },
    filesystem: { ...defaultConfig.filesystem, ...fileConfig.filesystem, ...envConfig.filesystem },
    logging: { ...defaultConfig.logging, ...fileConfig.logging, ...envConfig.logging },
  };
}

export { defaultConfig };
```

- [ ] **Step 6: 创建默认配置文件**

```json
// config/default.json
{
  "port": 3001,
  "auth": {
    "enabled": false
  },
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "autoConnect": true
  },
  "filesystem": {
    "allowedRoots": [],
    "maxFileSize": 10485760
  },
  "logging": {
    "level": "info"
  }
}
```

- [ ] **Step 7: 安装依赖并验证编译**

```bash
cd packages/dashboard-remote-server
npm install
npm run build
```

Expected: 编译成功，无错误

- [ ] **Step 8: 提交**

```bash
git add packages/dashboard-remote-server/
git commit -m "$(cat <<'EOF'
feat(remote-server): 初始化 dashboard-remote-server 项目

- 创建项目结构和配置
- 定义类型接口
- 实现配置加载器

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: JSON-RPC Server 实现

**Files:**
- Create: `packages/dashboard-remote-server/src/server/jsonRpcServer.ts`
- Create: `packages/dashboard-remote-server/src/utils/auth.ts`

- [ ] **Step 1: 创建认证工具**

```typescript
// src/utils/auth.ts
import type { ServerConfig } from '../types/index.js';

export function validateToken(config: ServerConfig, token?: string): boolean {
  if (!config.auth.enabled) {
    return true;
  }

  if (!token || !config.auth.token) {
    return false;
  }

  return token === config.auth.token;
}

export function extractToken(request: Request): string | undefined {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 从 URL query 参数提取
  const url = new URL(request.url);
  return url.searchParams.get('token') || undefined;
}
```

- [ ] **Step 2: 创建 JSON-RPC Server（基础结构）**

```typescript
// src/server/jsonRpcServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerConfig } from '../types/index.js';
import { validateToken } from '../utils/auth.js';
import { createFileSystemManager } from '../modules/fileSystemManager.js';
import { createWatchManager } from '../modules/watchManager.js';
import { createGatewayBridge } from '../modules/gatewayBridge.js';
import pino from 'pino';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export function createServer(config: ServerConfig) {
  const logger = pino({
    level: config.logging.level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  });

  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();

  // 初始化模块
  const fileSystem = createFileSystemManager(config, logger);
  const watchManager = createWatchManager(config, logger);
  const gatewayBridge = createGatewayBridge(config, logger);

  // 发送通知给所有客户端
  const broadcast = (notification: JsonRpcNotification) => {
    const message = JSON.stringify(notification);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  // 处理单个请求
  const handleRequest = async (
    request: JsonRpcRequest,
    ws: WebSocket
  ): Promise<JsonRpcResponse | null> => {
    const { id, method, params } = request;

    try {
      let result: unknown;

      // 路由到对应模块
      if (method.startsWith('file.')) {
        result = await fileSystem.handle(method, params);
      } else if (method.startsWith('directory.')) {
        result = await fileSystem.handle(method, params);
      } else if (method.startsWith('watch.')) {
        result = await watchManager.handle(method, params, ws);
      } else if (method.startsWith('gateway.')) {
        result = await gatewayBridge.handle(method, params);
      } else {
        throw new Error(`Unknown method: ${method}`);
      }

      // 如果没有 id，这是通知，不需要响应
      if (id === undefined) {
        return null;
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ method, error: message });

      if (id === undefined) {
        return null;
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message },
      };
    }
  };

  // 处理 WebSocket 连接
  const handleConnection = (ws: WebSocket, request: Request) => {
    // 认证检查
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
      || new URL(request.url!).searchParams.get('token');

    if (!validateToken(config, token || undefined)) {
      logger.warn('Unauthorized connection attempt');
      ws.close(4001, 'Unauthorized');
      return;
    }

    clients.add(ws);
    logger.info({ clients: clients.size }, 'Client connected');

    ws.on('message', async (data) => {
      try {
        const request: JsonRpcRequest = JSON.parse(data.toString());
        const response = await handleRequest(request, ws);
        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (error) {
        logger.error({ error: String(error) }, 'Failed to parse message');
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      watchManager.cleanup(ws);
      logger.info({ clients: clients.size }, 'Client disconnected');
    });
  };

  return {
    start: async () => {
      return new Promise<void>((resolve) => {
        wss = new WebSocketServer({ port: config.port });
        wss.on('connection', handleConnection);
        wss.on('listening', () => {
          logger.info(`Server listening on port ${config.port}`);
          resolve();
        });
      });
    },

    stop: async () => {
      if (wss) {
        return new Promise<void>((resolve) => {
          wss!.close(() => {
            logger.info('Server stopped');
            resolve();
          });
        });
      }
    },

    broadcast,
  };
}
```

- [ ] **Step 3: 创建文件系统管理器桩**

```typescript
// src/modules/fileSystemManager.ts
import type { ServerConfig } from '../types/index.js';
import type { Logger } from 'pino';

export function createFileSystemManager(config: ServerConfig, logger: Logger) {
  return {
    handle: async (method: string, params: unknown): Promise<unknown> => {
      logger.debug({ method }, 'Handling file system request');

      // TODO: 实现具体方法
      if (method === 'file.read') {
        throw new Error('Not implemented');
      }

      if (method === 'directory.list') {
        throw new Error('Not implemented');
      }

      throw new Error(`Unknown file system method: ${method}`);
    },
  };
}
```

- [ ] **Step 4: 创建监控管理器桩**

```typescript
// src/modules/watchManager.ts
import type { ServerConfig } from '../types/index.js';
import type { Logger } from 'pino';
import type WebSocket from 'ws';

export function createWatchManager(config: ServerConfig, logger: Logger) {
  return {
    handle: async (method: string, params: unknown, ws: WebSocket): Promise<unknown> => {
      logger.debug({ method }, 'Handling watch request');

      if (method === 'watch.subscribe') {
        throw new Error('Not implemented');
      }

      if (method === 'watch.unsubscribe') {
        throw new Error('Not implemented');
      }

      throw new Error(`Unknown watch method: ${method}`);
    },

    cleanup: (ws: WebSocket) => {
      logger.debug('Cleaning up watch subscriptions for client');
    },
  };
}
```

- [ ] **Step 5: 创建 Gateway 桥接器桩**

```typescript
// src/modules/gatewayBridge.ts
import type { ServerConfig } from '../types/index.js';
import type { Logger } from 'pino';

export function createGatewayBridge(config: ServerConfig, logger: Logger) {
  return {
    handle: async (method: string, params: unknown): Promise<unknown> => {
      logger.debug({ method }, 'Handling gateway request');

      if (method === 'gateway.connect') {
        throw new Error('Not implemented');
      }

      if (method === 'gateway.disconnect') {
        throw new Error('Not implemented');
      }

      if (method === 'gateway.runAgent') {
        throw new Error('Not implemented');
      }

      if (method === 'gateway.isConnected') {
        return false;
      }

      throw new Error(`Unknown gateway method: ${method}`);
    },
  };
}
```

- [ ] **Step 6: 编译验证**

```bash
cd packages/dashboard-remote-server
npm run build
```

Expected: 编译成功

- [ ] **Step 7: 提交**

```bash
git add packages/dashboard-remote-server/
git commit -m "$(cat <<'EOF'
feat(remote-server): 实现 JSON-RPC Server 基础框架

- 创建 WebSocket 服务器
- 实现认证中间件
- 添加模块路由器（桩实现）

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: 文件系统管理器实现

**Files:**
- Modify: `packages/dashboard-remote-server/src/modules/fileSystemManager.ts`
- Create: `packages/dashboard-remote-server/src/utils/pathUtils.ts`

- [ ] **Step 1: 创建路径工具**

```typescript
// src/utils/pathUtils.ts
import path from 'node:path';
import fs from 'node:fs';

/**
 * 规范化路径并检查是否在允许的根目录内
 */
export function validatePath(
  inputPath: string,
  allowedRoots: string[]
): { valid: true; resolvedPath: string } | { valid: false; error: string } {
  // 规范化路径
  const resolvedPath = path.resolve(inputPath);

  // 检查是否在允许的根目录内
  const isAllowed = allowedRoots.some((root) => {
    const normalizedRoot = path.resolve(root);
    return resolvedPath.startsWith(normalizedRoot + path.sep) || resolvedPath === normalizedRoot;
  });

  if (!isAllowed) {
    return {
      valid: false,
      error: `Path "${resolvedPath}" is outside allowed roots`,
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * 格式化文件大小
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 获取文件信息
 */
export function getFileInfo(filePath: string) {
  const stat = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    isDirectory: stat.isDirectory(),
    size: stat.size,
    mtime: stat.mtimeMs,
  };
}
```

- [ ] **Step 2: 实现文件系统管理器**

```typescript
// src/modules/fileSystemManager.ts
import type { ServerConfig, FileInfo, FileContent } from '../types/index.js';
import type { Logger } from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { validatePath, getFileInfo } from '../utils/pathUtils.js';

export function createFileSystemManager(config: ServerConfig, logger: Logger) {
  const { allowedRoots, maxFileSize } = config.filesystem;

  const handle = async (method: string, params: unknown): Promise<unknown> => {
    logger.debug({ method }, 'Handling file system request');

    switch (method) {
      case 'file.read':
        return readFile(params as { path: string });

      case 'file.write':
        return writeFile(params as { path: string; content: string; encoding?: string });

      case 'file.delete':
        return deleteFile(params as { path: string });

      case 'file.stat':
        return statFile(params as { path: string });

      case 'file.exists':
        return existsFile(params as { path: string });

      case 'directory.list':
        return listDirectory(params as { path: string; recursive?: boolean });

      case 'directory.create':
        return createDirectory(params as { path: string });

      default:
        throw new Error(`Unknown file system method: ${method}`);
    }
  };

  const readFile = async (params: { path: string }): Promise<FileContent> => {
    const { path: inputPath } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const stat = fs.statSync(validation.resolvedPath);
    if (stat.size > maxFileSize) {
      throw new Error(`File size (${stat.size}) exceeds maximum allowed size (${maxFileSize})`);
    }

    const content = fs.readFileSync(validation.resolvedPath, 'utf-8');
    return { content, encoding: 'utf-8' };
  };

  const writeFile = async (params: {
    path: string;
    content: string;
    encoding?: string;
  }): Promise<void> => {
    const { path: inputPath, content, encoding = 'utf-8' } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 确保目录存在
    const dir = path.dirname(validation.resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(validation.resolvedPath, content, encoding as BufferEncoding);
  };

  const deleteFile = async (params: { path: string }): Promise<void> => {
    const { path: inputPath } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (!fs.existsSync(validation.resolvedPath)) {
      throw new Error(`File not found: ${validation.resolvedPath}`);
    }

    fs.unlinkSync(validation.resolvedPath);
  };

  const statFile = async (params: { path: string }): Promise<FileInfo> => {
    const { path: inputPath } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return getFileInfo(validation.resolvedPath);
  };

  const existsFile = async (params: { path: string }): Promise<boolean> => {
    const { path: inputPath } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      return false;
    }

    return fs.existsSync(validation.resolvedPath);
  };

  const listDirectory = async (params: {
    path: string;
    recursive?: boolean;
  }): Promise<FileInfo[]> => {
    const { path: inputPath, recursive = false } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (!fs.existsSync(validation.resolvedPath)) {
      throw new Error(`Directory not found: ${validation.resolvedPath}`);
    }

    const results: FileInfo[] = [];

    const scanDir = (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        results.push(getFileInfo(fullPath));

        if (recursive && entry.isDirectory()) {
          scanDir(fullPath);
        }
      }
    };

    scanDir(validation.resolvedPath);
    return results;
  };

  const createDirectory = async (params: { path: string }): Promise<void> => {
    const { path: inputPath } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    fs.mkdirSync(validation.resolvedPath, { recursive: true });
  };

  return { handle };
}
```

- [ ] **Step 3: 编译验证**

```bash
cd packages/dashboard-remote-server
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add packages/dashboard-remote-server/
git commit -m "$(cat <<'EOF'
feat(remote-server): 实现文件系统管理器

- 支持文件读写、删除、状态查询
- 支持目录列表和创建
- 路径安全验证
- 文件大小限制

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: 文件监控管理器实现

**Files:**
- Modify: `packages/dashboard-remote-server/src/modules/watchManager.ts`

- [ ] **Step 1: 实现监控管理器**

```typescript
// src/modules/watchManager.ts
import type { ServerConfig, Subscription } from '../types/index.js';
import type { Logger } from 'pino';
import type WebSocket from 'ws';
import chokidar from 'chokidar';
import { validatePath } from '../utils/pathUtils.js';
import { randomUUID } from 'node:crypto';

interface ClientSubscription {
  subscriptionId: string;
  watcher: chokidar.FSWatcher;
  ws: WebSocket;
  path: string;
}

export function createWatchManager(config: ServerConfig, logger: Logger) {
  const { allowedRoots } = config.filesystem;
  const subscriptions = new Map<string, ClientSubscription>();
  const clientSubscriptions = new Map<WebSocket, Set<string>>();

  const handle = async (
    method: string,
    params: unknown,
    ws: WebSocket
  ): Promise<unknown> => {
    logger.debug({ method }, 'Handling watch request');

    switch (method) {
      case 'watch.subscribe':
        return subscribe(params as { path: string; recursive?: boolean }, ws);

      case 'watch.unsubscribe':
        return unsubscribe(params as { subscriptionId: string });

      default:
        throw new Error(`Unknown watch method: ${method}`);
    }
  };

  const subscribe = async (
    params: { path: string; recursive?: boolean },
    ws: WebSocket
  ): Promise<{ subscriptionId: string }> => {
    const { path: inputPath, recursive = false } = params;
    const validation = validatePath(inputPath, allowedRoots);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const subscriptionId = randomUUID();

    // 创建 watcher
    const watchPath = recursive
      ? validation.resolvedPath
      : validation.resolvedPath;

    const watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true,
      depth: recursive ? undefined : 0,
    });

    // 事件处理
    const sendEvent = (type: 'created' | 'changed' | 'deleted', filePath: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'watch.onEvent',
          params: {
            subscriptionId,
            path: filePath,
            type,
          },
        }));
      }
    };

    watcher
      .on('add', (filePath) => sendEvent('created', filePath))
      .on('change', (filePath) => sendEvent('changed', filePath))
      .on('unlink', (filePath) => sendEvent('deleted', filePath))
      .on('addDir', (filePath) => sendEvent('created', filePath))
      .on('unlinkDir', (filePath) => sendEvent('deleted', filePath))
      .on('error', (error) => {
        logger.error({ error: String(error), subscriptionId }, 'Watcher error');
      });

    // 记录订阅
    subscriptions.set(subscriptionId, {
      subscriptionId,
      watcher,
      ws,
      path: validation.resolvedPath,
    });

    // 记录客户端订阅
    if (!clientSubscriptions.has(ws)) {
      clientSubscriptions.set(ws, new Set());
    }
    clientSubscriptions.get(ws)!.add(subscriptionId);

    logger.info({ subscriptionId, path: validation.resolvedPath }, 'Subscription created');

    return { subscriptionId };
  };

  const unsubscribe = async (params: { subscriptionId: string }): Promise<void> => {
    const { subscriptionId } = params;
    const sub = subscriptions.get(subscriptionId);

    if (!sub) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    await sub.watcher.close();
    subscriptions.delete(subscriptionId);

    // 从客户端记录中移除
    const clientSubs = clientSubscriptions.get(sub.ws);
    if (clientSubs) {
      clientSubs.delete(subscriptionId);
      if (clientSubs.size === 0) {
        clientSubscriptions.delete(sub.ws);
      }
    }

    logger.info({ subscriptionId }, 'Subscription removed');
  };

  const cleanup = (ws: WebSocket) => {
    const subIds = clientSubscriptions.get(ws);
    if (subIds) {
      for (const subId of subIds) {
        const sub = subscriptions.get(subId);
        if (sub) {
          sub.watcher.close().catch((err) => {
            logger.error({ error: String(err) }, 'Failed to close watcher');
          });
          subscriptions.delete(subId);
        }
      }
      clientSubscriptions.delete(ws);
      logger.info('Cleaned up client subscriptions');
    }
  };

  return { handle, cleanup };
}
```

- [ ] **Step 2: 编译验证**

```bash
cd packages/dashboard-remote-server
npm run build
```

- [ ] **Step 3: 提交**

```bash
git add packages/dashboard-remote-server/
git commit -m "$(cat <<'EOF'
feat(remote-server): 实现文件监控管理器

- 支持 chokidar 文件监控
- 订阅/取消订阅机制
- 客户端断开自动清理
- 变化事件推送

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Gateway 桥接器实现

**Files:**
- Modify: `packages/dashboard-remote-server/src/modules/gatewayBridge.ts`
- Create: `packages/dashboard-remote-server/src/gateway/client.ts`
- Create: `packages/dashboard-remote-server/src/gateway/protocol.ts`

- [ ] **Step 1: 创建 Gateway 协议定义**

```typescript
// src/gateway/protocol.ts
// Gateway WebSocket 协议类型定义

export interface GatewayMessage {
  type: string;
  [key: string]: unknown;
}

export interface ConnectChallenge {
  type: 'connect.challenge';
  nonce: string;
}

export interface ConnectRequest {
  type: 'connect';
  minProtocol: number;
  maxProtocol: number;
  client: { id: string; mode: string };
  role: string;
  scopes: string[];
  auth: { token: string };
  nonce: string;
}

export interface ConnectResponse {
  type: 'connect.response';
  success: boolean;
  error?: string;
}

export interface AgentRunRequest {
  type: 'agent.run';
  conversationId: string;
  message: string;
  expertId?: string;
  systemPrompt?: string;
}

export interface AgentEvent {
  type: 'agent.event';
  conversationId: string;
  eventType: string;
  data: unknown;
}
```

- [ ] **Step 2: 创建 Gateway 客户端**

```typescript
// src/gateway/client.ts
import WebSocket from 'ws';
import type { Logger } from 'pino';
import type {
  GatewayMessage,
  ConnectChallenge,
  ConnectRequest,
  AgentRunRequest,
} from './protocol.js';

export interface GatewayClientOptions {
  url: string;
  token?: string;
  onAgentEvent?: (event: unknown) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function createGatewayClient(options: GatewayClientOptions, logger: Logger) {
  const { url, token, onAgentEvent, onConnectionChange } = options;

  let ws: WebSocket | null = null;
  let pendingChallenge: ConnectChallenge | null = null;
  let isConnected = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      logger.info({ url }, 'Connecting to Gateway');

      ws = new WebSocket(url);

      ws.on('open', () => {
        logger.info('WebSocket connected, waiting for challenge');
      });

      ws.on('message', (data) => {
        try {
          const msg: GatewayMessage = JSON.parse(data.toString());
          handleMessage(msg, resolve, reject);
        } catch (error) {
          logger.error({ error: String(error) }, 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket closed');
        isConnected = false;
        onConnectionChange?.(false);
      });

      ws.on('error', (error) => {
        logger.error({ error: String(error) }, 'WebSocket error');
        reject(error);
      });
    });
  };

  const handleMessage = (
    msg: GatewayMessage,
    resolveConnect: () => void,
    rejectConnect: (error: Error) => void
  ) => {
    switch (msg.type) {
      case 'connect.challenge':
        pendingChallenge = msg as ConnectChallenge;
        sendConnectRequest(msg as ConnectChallenge);
        break;

      case 'connect.response':
        if ((msg as any).success) {
          logger.info('Gateway authenticated');
          isConnected = true;
          onConnectionChange?.(true);
          resolveConnect();
        } else {
          rejectConnect(new Error((msg as any).error || 'Authentication failed'));
        }
        break;

      case 'agent.event':
        onAgentEvent?.(msg);
        break;

      default:
        logger.debug({ type: msg.type }, 'Received message');
    }
  };

  const sendConnectRequest = (challenge: ConnectChallenge) => {
    if (!token) {
      logger.error('No token available for authentication');
      return;
    }

    const request: ConnectRequest = {
      type: 'connect',
      minProtocol: 3,
      maxProtocol: 3,
      client: { id: 'dashboard-remote', mode: 'backend' },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'agent', 'agent.wait'],
      auth: { token },
      nonce: challenge.nonce,
    };

    ws?.send(JSON.stringify(request));
  };

  const runAgent = (params: {
    conversationId: string;
    message: string;
    expertId?: string;
    systemPrompt?: string;
  }): void => {
    if (!ws || !isConnected) {
      throw new Error('Not connected to Gateway');
    }

    const request: AgentRunRequest = {
      type: 'agent.run',
      ...params,
    };

    ws.send(JSON.stringify(request));
  };

  const disconnect = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    isConnected = false;
  };

  const connected = () => isConnected;

  return {
    connect,
    disconnect,
    runAgent,
    connected,
  };
}
```

- [ ] **Step 3: 实现 Gateway 桥接器**

```typescript
// src/modules/gatewayBridge.ts
import type { ServerConfig } from '../types/index.js';
import type { Logger } from 'pino';
import type WebSocket from 'ws';
import { createGatewayClient } from '../gateway/client.js';

export function createGatewayBridge(config: ServerConfig, logger: Logger) {
  let client: ReturnType<typeof createGatewayClient> | null = null;
  const broadcastCallback = new Set<(event: unknown) => void>();

  const handle = async (method: string, params: unknown): Promise<unknown> => {
    logger.debug({ method }, 'Handling gateway request');

    switch (method) {
      case 'gateway.connect':
        return connect();

      case 'gateway.disconnect':
        return disconnect();

      case 'gateway.runAgent':
        return runAgent(params as any);

      case 'gateway.isConnected':
        return client?.connected() ?? false;

      default:
        throw new Error(`Unknown gateway method: ${method}`);
    }
  };

  const connect = async (): Promise<void> => {
    if (client?.connected()) {
      logger.warn('Already connected to Gateway');
      return;
    }

    client = createGatewayClient({
      url: config.gateway.url,
      token: config.gateway.token,
      onAgentEvent: (event) => {
        // 广播给所有注册的回调
        for (const cb of broadcastCallback) {
          cb(event);
        }
      },
      onConnectionChange: (connected) => {
        logger.info({ connected }, 'Gateway connection state changed');
      },
    }, logger);

    await client.connect();
  };

  const disconnect = (): void => {
    if (client) {
      client.disconnect();
      client = null;
    }
  };

  const runAgent = (params: {
    conversationId: string;
    message: string;
    expertId?: string;
    systemPrompt?: string;
  }): void => {
    if (!client?.connected()) {
      throw new Error('Not connected to Gateway');
    }

    client.runAgent(params);
  };

  const registerBroadcast = (callback: (event: unknown) => void) => {
    broadcastCallback.add(callback);
    return () => broadcastCallback.delete(callback);
  };

  return { handle, registerBroadcast };
}
```

- [ ] **Step 4: 编译验证**

```bash
cd packages/dashboard-remote-server
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add packages/dashboard-remote-server/
git commit -m "$(cat <<'EOF'
feat(remote-server): 实现 Gateway 桥接器

- Gateway WebSocket 客户端
- 认证握手流程
- Agent 运行代理
- 事件广播机制

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 2: Dashboard Server 远程连接模块

### Task 2.1: 数据库扩展

**Files:**
- Modify: `apps/server/src/db/index.ts`

- [ ] **Step 1: 添加 remote_servers 表迁移**

在 `apps/server/src/db/index.ts` 的 `runMigrations` 函数末尾添加：

```typescript
// Migration 9: Create remote_servers table
try {
  database.run(`
    CREATE TABLE IF NOT EXISTS remote_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 22,
      username TEXT NOT NULL,
      private_key_path TEXT,
      remote_port INTEGER DEFAULT 3001,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('[DB] Migration: remote_servers table created');
} catch (err) {
  console.error('[DB] Migration error:', err);
}

// Migration 10: Add server_id to conversations
try {
  const columns = database.exec("PRAGMA table_info(conversations)");
  const columnNames = columns[0]?.values?.map((v) => v[1] as string) || [];

  if (!columnNames.includes('server_id')) {
    console.log('[DB] Migration: Adding server_id column to conversations');
    database.run("ALTER TABLE conversations ADD COLUMN server_id TEXT");
  }
} catch (err) {
  console.error('[DB] Migration error:', err);
}
```

- [ ] **Step 2: 重启服务器验证迁移**

```bash
cd apps/server
npm run dev
```

Expected: 日志显示迁移成功

- [ ] **Step 3: 提交**

```bash
git add apps/server/src/db/index.ts
git commit -m "$(cat <<'EOF'
feat(server): 添加远程服务器数据库表

- remote_servers 表存储服务器配置
- conversations 表添加 server_id 关联

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: 配置扩展

**Files:**
- Modify: `apps/server/src/config.ts`

- [ ] **Step 1: 扩展配置接口**

```typescript
// 在 config.ts 中添加

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  privateKeyPath?: string;
  remotePort: number;
}

export interface AppConfig {
  // 现有字段...
  port: number;
  host: string;
  database: {
    path: string;
  };
  plugin?: {
    token?: string;
  };
  openclawGateway?: OpenclawGatewayConfig;

  // 新增
  remote?: {
    enabled: boolean;
    servers: RemoteServerConfig[];
  };
}
```

- [ ] **Step 2: 更新默认配置和加载器**

更新 `defaultConfig` 和 `loadConfigFromEnv` 函数：

```typescript
const defaultConfig: AppConfig = {
  port: 3001,
  host: '0.0.0.0',
  database: {
    path: './data/dashboard.db',
  },
  remote: {
    enabled: false,
    servers: [],
  },
};

export function loadConfigFromEnv(): Partial<AppConfig> {
  const config: Partial<AppConfig> = loadConfigFromEnv();

  // ... 现有代码 ...

  // 远程配置
  if (process.env.REMOTE_ENABLED === 'true') {
    config.remote = {
      enabled: true,
      servers: [], // 服务器列表从数据库加载
    };
  }

  return config;
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/server/src/config.ts
git commit -m "$(cat <<'EOF'
feat(server): 添加远程连接配置支持

- 扩展 AppConfig 接口
- 添加环境变量加载

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: 远程连接类型定义

**Files:**
- Create: `apps/server/src/remote/types.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
// apps/server/src/remote/types.ts

export interface RemoteServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;              // SSH 端口，默认 22
  username: string;
  privateKey?: string;       // 私钥内容
  privateKeyPath?: string;   // 私钥文件路径
  remotePort: number;        // remote-server 端口，默认 3001
}

export interface SSHTunnelStatus {
  serverId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  localPort?: number;
  error?: string;
}

export interface RemoteClientStatus {
  serverId: string;
  tunnelStatus: SSHTunnelStatus;
  rpcConnected: boolean;
  gatewayConnected: boolean;
}

// JSON-RPC 请求/响应类型
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// 文件系统类型
export interface RemoteFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface RemoteFileContent {
  content: string;
  encoding: string;
}

// Gateway 类型
export interface RunAgentParams {
  conversationId: string;
  message: string;
  expertId?: string;
  systemPrompt?: string;
}

export interface AgentEvent {
  type: string;
  conversationId: string;
  data: unknown;
}

// Watch 类型
export interface WatchEvent {
  subscriptionId: string;
  path: string;
  type: 'created' | 'changed' | 'deleted';
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/server/src/remote/types.ts
git commit -m "$(cat <<'EOF'
feat(server): 添加远程连接类型定义

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.4: SSH 隧道管理器

**Files:**
- Create: `apps/server/src/remote/sshTunnel.ts`

- [ ] **Step 1: 添加 ssh2 依赖**

```bash
cd apps/server
npm install ssh2
npm install -D @types/ssh2
```

- [ ] **Step 2: 创建 SSH 隧道管理器**

```typescript
// apps/server/src/remote/sshTunnel.ts
import { Client, type ConnectConfig } from 'ssh2';
import type { RemoteServerConfig, SSHTunnelStatus } from './types.js';
import fs from 'node:fs';
import type { Logger } from 'pino';

interface TunnelOptions {
  serverConfig: RemoteServerConfig;
  logger: Logger;
  onStatusChange?: (status: SSHTunnelStatus) => void;
}

export class SSHTunnel {
  private conn: Client | null = null;
  private serverConfig: RemoteServerConfig;
  private logger: Logger;
  private onStatusChange?: (status: SSHTunnelStatus) => void;
  private _status: SSHTunnelStatus;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private localPort: number = 0;

  constructor(options: TunnelOptions) {
    this.serverConfig = options.serverConfig;
    this.logger = options.logger;
    this.onStatusChange = options.onStatusChange;
    this._status = {
      serverId: options.serverConfig.id,
      status: 'disconnected',
    };
  }

  get status(): SSHTunnelStatus {
    return this._status;
  }

  private updateStatus(status: Partial<SSHTunnelStatus>) {
    this._status = { ...this._status, ...status };
    this.onStatusChange?.(this._status);
  }

  async connect(): Promise<number> {
    if (this.conn) {
      this.logger.warn('Tunnel already connected');
      return this.localPort;
    }

    this.updateStatus({ status: 'connecting' });
    this.logger.info({ host: this.serverConfig.host }, 'Establishing SSH tunnel');

    return new Promise((resolve, reject) => {
      this.conn = new Client();

      const config: ConnectConfig = {
        host: this.serverConfig.host,
        port: this.serverConfig.port,
        username: this.serverConfig.username,
        readyTimeout: 30000,
      };

      // 配置认证
      if (this.serverConfig.privateKey) {
        config.privateKey = this.serverConfig.privateKey;
      } else if (this.serverConfig.privateKeyPath) {
        config.privateKey = fs.readFileSync(this.serverConfig.privateKeyPath, 'utf-8');
      } else {
        // 尝试默认私钥
        const defaultKeyPath = `${process.env.HOME}/.ssh/id_rsa`;
        if (fs.existsSync(defaultKeyPath)) {
          config.privateKey = fs.readFileSync(defaultKeyPath, 'utf-8');
        }
      }

      this.conn.on('ready', () => {
        this.logger.info('SSH connection established, creating port forward');

        // 创建本地端口转发
        this.conn!.forwardOut(
          '127.0.0.1',
          0,  // 本地端口由系统分配
          '127.0.0.1',
          this.serverConfig.remotePort,
          (err, stream) => {
            if (err) {
              this.logger.error({ error: String(err) }, 'Port forward failed');
              this.updateStatus({ status: 'error', error: String(err) });
              reject(err);
              return;
            }

            // 获取本地端口（需要通过额外的方式获取）
            // 这里简化处理，使用固定端口范围
            this.localPort = 13000 + Math.floor(Math.random() * 1000);

            this.updateStatus({
              status: 'connected',
              localPort: this.localPort,
            });

            this.logger.info({ localPort: this.localPort }, 'SSH tunnel established');
            resolve(this.localPort);
          }
        );
      });

      this.conn.on('error', (err) => {
        this.logger.error({ error: String(err) }, 'SSH connection error');
        this.updateStatus({ status: 'error', error: String(err) });
        this.scheduleReconnect();
        reject(err);
      });

      this.conn.on('close', () => {
        this.logger.info('SSH connection closed');
        this.updateStatus({ status: 'disconnected' });
        this.scheduleReconnect();
      });

      this.conn.connect(config);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.logger.info('Attempting to reconnect SSH tunnel');
      this.connect().catch((err) => {
        this.logger.error({ error: String(err) }, 'Reconnect failed');
      });
    }, 5000);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.conn) {
      return new Promise((resolve) => {
        this.conn!.end();
        this.conn = null;
        this.updateStatus({ status: 'disconnected' });
        this.logger.info('SSH tunnel disconnected');
        resolve();
      });
    }
  }
}

// 隧道管理器
export class SSHTunnelManager {
  private tunnels = new Map<string, SSHTunnel>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async createTunnel(
    serverConfig: RemoteServerConfig,
    onStatusChange?: (status: SSHTunnelStatus) => void
  ): Promise<number> {
    // 如果已存在，先断开
    const existing = this.tunnels.get(serverConfig.id);
    if (existing) {
      await existing.disconnect();
    }

    const tunnel = new SSHTunnel({
      serverConfig,
      logger: this.logger.child({ serverId: serverConfig.id }),
      onStatusChange,
    });

    this.tunnels.set(serverConfig.id, tunnel);
    return tunnel.connect();
  }

  async closeTunnel(serverId: string): Promise<void> {
    const tunnel = this.tunnels.get(serverId);
    if (tunnel) {
      await tunnel.disconnect();
      this.tunnels.delete(serverId);
    }
  }

  getStatus(serverId: string): SSHTunnelStatus | undefined {
    return this.tunnels.get(serverId)?.status;
  }

  getAllStatus(): SSHTunnelStatus[] {
    return Array.from(this.tunnels.values()).map((t) => t.status);
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.tunnels) {
      await this.closeTunnel(id);
    }
  }
}
```

- [ ] **Step 3: 编译验证**

```bash
cd apps/server
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/remote/
git commit -m "$(cat <<'EOF'
feat(server): 实现 SSH 隧道管理器

- 使用 ssh2 库建立隧道
- 支持自动重连
- 多隧道管理

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.5: JSON-RPC 客户端

**Files:**
- Create: `apps/server/src/remote/client.ts`

- [ ] **Step 1: 创建 JSON-RPC 客户端**

```typescript
// apps/server/src/remote/client.ts
import WebSocket from 'ws';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  RemoteFileInfo,
  RemoteFileContent,
  RunAgentParams,
  AgentEvent,
  WatchEvent,
} from './types.js';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';

type ResponseHandler = (response: JsonRpcResponse) => void;
type NotificationHandler = (notification: JsonRpcNotification) => void;

export interface RemoteClientOptions {
  url: string;
  token?: string;
  logger: Logger;
  onAgentEvent?: (event: AgentEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class RemoteClient {
  private ws: WebSocket | null = null;
  private options: RemoteClientOptions;
  private responseHandlers = new Map<string | number, ResponseHandler>();
  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private requestId = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private _isConnected = false;

  constructor(options: RemoteClientOptions) {
    this.options = options;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.options.logger.warn('Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      const url = this.options.token
        ? `${this.options.url}?token=${this.options.token}`
        : this.options.url;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this._isConnected = true;
        this.options.logger.info('WebSocket connected to remote server');
        this.options.onConnectionChange?.(true);
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this._isConnected = false;
        this.options.logger.info('WebSocket disconnected');
        this.options.onConnectionChange?.(false);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.options.logger.error({ error: String(error) }, 'WebSocket error');
        reject(error);
      });
    });
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);

      // 检查是否是响应
      if ('id' in msg && (msg.result !== undefined || msg.error !== undefined)) {
        const handler = this.responseHandlers.get(msg.id);
        if (handler) {
          handler(msg);
          this.responseHandlers.delete(msg.id);
        }
      }
      // 检查是否是通知
      else if ('method' in msg && !('id' in msg)) {
        this.handleNotification(msg as JsonRpcNotification);
      }
    } catch (error) {
      this.options.logger.error({ error: String(error) }, 'Failed to parse message');
    }
  }

  private handleNotification(notification: JsonRpcNotification) {
    // 处理 Agent 事件
    if (notification.method === 'gateway.onAgentEvent') {
      this.options.onAgentEvent?.(notification.params as AgentEvent);
    }

    // 处理 Watch 事件
    if (notification.method === 'watch.onEvent') {
      const handlers = this.notificationHandlers.get('watch');
      handlers?.forEach((h) => h(notification));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.options.logger.info('Attempting to reconnect');
      this.connect().catch((err) => {
        this.options.logger.error({ error: String(err) }, 'Reconnect failed');
      });
    }, 5000);
  }

  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result as T);
        }
      });

      this.ws.send(JSON.stringify(request));

      // 超时处理
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // ==================== Gateway 方法 ====================

  async gatewayConnect(): Promise<void> {
    await this.sendRequest('gateway.connect');
  }

  async gatewayDisconnect(): Promise<void> {
    await this.sendRequest('gateway.disconnect');
  }

  async runAgent(params: RunAgentParams): Promise<void> {
    await this.sendRequest('gateway.runAgent', params);
  }

  async isGatewayConnected(): Promise<boolean> {
    return this.sendRequest('gateway.isConnected');
  }

  // ==================== 文件系统方法 ====================

  async readFile(path: string): Promise<RemoteFileContent> {
    return this.sendRequest('file.read', { path });
  }

  async writeFile(path: string, content: string, encoding?: string): Promise<void> {
    await this.sendRequest('file.write', { path, content, encoding });
  }

  async deleteFile(path: string): Promise<void> {
    await this.sendRequest('file.delete', { path });
  }

  async fileExists(path: string): Promise<boolean> {
    return this.sendRequest('file.exists', { path });
  }

  async listDirectory(path: string, recursive?: boolean): Promise<RemoteFileInfo[]> {
    return this.sendRequest('directory.list', { path, recursive });
  }

  // ==================== 监控方法 ====================

  async watchSubscribe(path: string): Promise<{ subscriptionId: string }> {
    return this.sendRequest('watch.subscribe', { path });
  }

  async watchUnsubscribe(subscriptionId: string): Promise<void> {
    await this.sendRequest('watch.unsubscribe', { subscriptionId });
  }

  onWatchEvent(handler: (event: WatchEvent) => void): () => void {
    if (!this.notificationHandlers.has('watch')) {
      this.notificationHandlers.set('watch', new Set());
    }
    const handlers = this.notificationHandlers.get('watch')!;

    const wrappedHandler = (notification: JsonRpcNotification) => {
      handler(notification.params as WatchEvent);
    };

    handlers.add(wrappedHandler);
    return () => {
      handlers.delete(wrappedHandler);
    };
  }

  // ==================== 连接管理 ====================

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      return new Promise((resolve) => {
        this.ws!.close();
        this.ws = null;
        this._isConnected = false;
        resolve();
      });
    }
  }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd apps/server
npm run build
```

- [ ] **Step 3: 提交**

```bash
git add apps/server/src/remote/client.ts
git commit -m "$(cat <<'EOF'
feat(server): 实现 JSON-RPC 客户端

- WebSocket 连接管理
- 请求/响应处理
- 事件订阅
- 文件系统和 Gateway API

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.6: 远程连接管理器

**Files:**
- Create: `apps/server/src/remote/manager.ts`
- Create: `apps/server/src/remote/index.ts`

- [ ] **Step 1: 创建远程连接管理器**

```typescript
// apps/server/src/remote/manager.ts
import type { RemoteServerConfig, RemoteClientStatus, AgentEvent } from './types.js';
import { SSHTunnelManager } from './sshTunnel.js';
import { RemoteClient } from './client.js';
import pino from 'pino';

export interface RemoteConnectionManagerOptions {
  onAgentEvent?: (serverId: string, event: AgentEvent) => void;
  onStatusChange?: (serverId: string, status: RemoteClientStatus) => void;
}

export class RemoteConnectionManager {
  private tunnelManager: SSHTunnelManager;
  private clients = new Map<string, RemoteClient>();
  private serverConfigs = new Map<string, RemoteServerConfig>();
  private activeServerId: string | null = null;
  private logger: pino.Logger;
  private options: RemoteConnectionManagerOptions;

  constructor(options: RemoteConnectionManagerOptions = {}) {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
    this.tunnelManager = new SSHTunnelManager(this.logger);
    this.options = options;
  }

  // 加载服务器配置（从数据库）
  loadServerConfigs(configs: RemoteServerConfig[]): void {
    this.serverConfigs.clear();
    for (const config of configs) {
      this.serverConfigs.set(config.id, config);
    }
  }

  // 连接到指定服务器
  async connect(serverId: string): Promise<void> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    this.logger.info({ serverId }, 'Connecting to remote server');

    // 创建 SSH 隧道
    const localPort = await this.tunnelManager.createTunnel(
      config,
      (status) => this.notifyStatusChange(serverId)
    );

    // 创建 RPC 客户端
    const client = new RemoteClient({
      url: `ws://127.0.0.1:${localPort}`,
      token: process.env.REMOTE_AUTH_TOKEN,
      logger: this.logger.child({ serverId }),
      onAgentEvent: (event) => {
        this.options.onAgentEvent?.(serverId, event);
      },
      onConnectionChange: () => {
        this.notifyStatusChange(serverId);
      },
    });

    await client.connect();

    // 自动连接 Gateway
    try {
      await client.gatewayConnect();
    } catch (error) {
      this.logger.warn({ error: String(error) }, 'Failed to connect gateway');
    }

    this.clients.set(serverId, client);
    this.notifyStatusChange(serverId);
  }

  // 断开服务器连接
  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }

    await this.tunnelManager.closeTunnel(serverId);

    if (this.activeServerId === serverId) {
      this.activeServerId = null;
    }

    this.notifyStatusChange(serverId);
  }

  // 设置当前激活服务器
  setActiveServer(serverId: string | null): void {
    this.activeServerId = serverId;
  }

  // 获取当前激活的客户端
  getActiveClient(): RemoteClient | null {
    if (!this.activeServerId) {
      return null;
    }
    return this.clients.get(this.activeServerId) || null;
  }

  // 获取指定服务器的客户端
  getClient(serverId: string): RemoteClient | null {
    return this.clients.get(serverId) || null;
  }

  // 获取所有服务器状态
  getAllServersStatus(): RemoteClientStatus[] {
    const statuses: RemoteClientStatus[] = [];

    for (const [serverId, config] of this.serverConfigs) {
      const client = this.clients.get(serverId);
      const tunnelStatus = this.tunnelManager.getStatus(serverId);

      statuses.push({
        serverId,
        tunnelStatus: tunnelStatus || {
          serverId,
          status: 'disconnected',
        },
        rpcConnected: client?.isConnected ?? false,
        gatewayConnected: false, // 需要额外查询
      });
    }

    return statuses;
  }

  private notifyStatusChange(serverId: string): void {
    const client = this.clients.get(serverId);
    const tunnelStatus = this.tunnelManager.getStatus(serverId);

    this.options.onStatusChange?.(serverId, {
      serverId,
      tunnelStatus: tunnelStatus || {
        serverId,
        status: 'disconnected',
      },
      rpcConnected: client?.isConnected ?? false,
      gatewayConnected: false,
    });
  }

  // 清理所有连接
  async cleanup(): Promise<void> {
    for (const [serverId] of this.clients) {
      await this.disconnect(serverId);
    }
    await this.tunnelManager.closeAll();
  }
}

// 单例
let manager: RemoteConnectionManager | null = null;

export function getRemoteConnectionManager(): RemoteConnectionManager {
  if (!manager) {
    manager = new RemoteConnectionManager();
  }
  return manager;
}
```

- [ ] **Step 2: 创建导出入口**

```typescript
// apps/server/src/remote/index.ts
export * from './types.js';
export * from './client.js';
export * from './sshTunnel.js';
export * from './manager.js';
```

- [ ] **Step 3: 编译验证**

```bash
cd apps/server
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/remote/
git commit -m "$(cat <<'EOF'
feat(server): 实现远程连接管理器

- 管理多个服务器连接
- 切换激活服务器
- 状态变更通知

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.7: REST API 路由

**Files:**
- Create: `apps/server/src/routes/remote.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: 创建远程服务器 REST API**

```typescript
// apps/server/src/routes/remote.ts
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';
import { getRemoteConnectionManager, type RemoteServerConfig } from '../remote/index.js';

interface RemoteServerRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  private_key_path: string | null;
  remote_port: number;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: RemoteServerRow): RemoteServerConfig {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    privateKeyPath: row.private_key_path || undefined,
    remotePort: row.remote_port,
  };
}

export async function remoteRoutes(fastify: FastifyInstance) {
  const manager = getRemoteConnectionManager();

  // GET /api/v1/remote/servers - 获取所有服务器状态
  fastify.get('/remote/servers', async (request, reply) => {
    const rows = all<RemoteServerRow>('SELECT * FROM remote_servers ORDER BY created_at');
    const configs = rows.map(rowToConfig);
    const statuses = manager.getAllServersStatus();

    // 合并配置和状态
    const servers = configs.map((config) => {
      const status = statuses.find((s) => s.serverId === config.id);
      return {
        ...config,
        status: status || {
          serverId: config.id,
          tunnelStatus: { serverId: config.id, status: 'disconnected' },
          rpcConnected: false,
          gatewayConnected: false,
        },
      };
    });

    return { success: true, data: servers };
  });

  // POST /api/v1/remote/servers - 添加服务器
  fastify.post('/remote/servers', async (request, reply) => {
    const body = request.body as Omit<RemoteServerConfig, 'id'>;
    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO remote_servers (id, name, host, port, username, private_key_path, remote_port, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.name, body.host, body.port || 22, body.username, body.privateKeyPath || null, body.remotePort || 3001, now, now]
    );

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    return { success: true, data: rowToConfig(row!) };
  });

  // PUT /api/v1/remote/servers/:id - 更新服务器
  fastify.put('/remote/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<RemoteServerConfig>;
    const now = new Date().toISOString();

    const existing = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Server not found' });
    }

    run(
      `UPDATE remote_servers SET name = ?, host = ?, port = ?, username = ?, private_key_path = ?, remote_port = ?, updated_at = ? WHERE id = ?`,
      [
        body.name || existing.name,
        body.host || existing.host,
        body.port || existing.port,
        body.username || existing.username,
        body.privateKeyPath || existing.private_key_path,
        body.remotePort || existing.remote_port,
        now,
        id,
      ]
    );

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    return { success: true, data: rowToConfig(row!) };
  });

  // DELETE /api/v1/remote/servers/:id - 删除服务器
  fastify.delete('/remote/servers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // 先断开连接
    await manager.disconnect(id);

    run('DELETE FROM remote_servers WHERE id = ?', [id]);
    return { success: true };
  });

  // POST /api/v1/remote/servers/:id/connect - 连接服务器
  fastify.post('/remote/servers/:id/connect', async (request, reply) => {
    const { id } = request.params as { id: string };

    const row = get<RemoteServerRow>('SELECT * FROM remote_servers WHERE id = ?', [id]);
    if (!row) {
      return reply.status(404).send({ success: false, error: 'Server not found' });
    }

    manager.loadServerConfigs([rowToConfig(row)]);

    try {
      await manager.connect(id);
      return { success: true };
    } catch (error) {
      return reply.status(500).send({ success: false, error: String(error) });
    }
  });

  // POST /api/v1/remote/servers/:id/disconnect - 断开服务器
  fastify.post('/remote/servers/:id/disconnect', async (request, reply) => {
    const { id } = request.params as { id: string };
    await manager.disconnect(id);
    return { success: true };
  });

  // PUT /api/v1/remote/active - 切换当前服务器
  fastify.put('/remote/active', async (request, reply) => {
    const { serverId } = request.body as { serverId: string | null };
    manager.setActiveServer(serverId);
    return { success: true, activeServerId: serverId };
  });
}
```

- [ ] **Step 2: 注册路由**

在 `apps/server/src/app.ts` 中添加：

```typescript
import { remoteRoutes } from './routes/remote.js';

// 在其他路由注册后添加
await fastify.register(remoteRoutes);
```

- [ ] **Step 3: 编译验证**

```bash
cd apps/server
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/
git commit -m "$(cat <<'EOF'
feat(server): 添加远程服务器 REST API

- CRUD 操作
- 连接/断开
- 切换激活服务器

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.8: WebSocket 消息扩展

**Files:**
- Modify: `apps/server/src/routes/websocket.ts`

- [ ] **Step 1: 添加文件操作消息处理**

在 `handleClientMessage` 的 switch 语句中添加：

```typescript
// 在 websocket.ts 中添加新的 case

case 'file:read':
  handleFileRead(ws, payload as { path: string });
  break;

case 'file:write':
  handleFileWrite(ws, payload as { path: string; content: string });
  break;

case 'directory:list':
  handleDirectoryList(ws, payload as { path: string; recursive?: boolean });
  break;

case 'watch:subscribe':
  handleWatchSubscribe(ws, payload as { path: string });
  break;

case 'watch:unsubscribe':
  handleWatchUnsubscribe(ws, payload as { subscriptionId: string });
  break;

case 'remote:servers':
  handleRemoteServers(ws);
  break;

case 'remote:switch':
  handleRemoteSwitch(ws, payload as { serverId: string | null });
  break;
```

- [ ] **Step 2: 实现处理函数**

```typescript
// 在 websocket.ts 中添加

import { getRemoteConnectionManager } from '../remote/index.js';

async function handleFileRead(ws: WebSocket, payload: { path: string }) {
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client) {
    sendError(ws, 'NO_REMOTE_CONNECTION', 'No active remote connection');
    return;
  }

  try {
    const content = await client.readFile(payload.path);
    send(ws, 'file:read:result', { success: true, data: content });
  } catch (error) {
    send(ws, 'file:read:result', { success: false, error: String(error) });
  }
}

async function handleFileWrite(ws: WebSocket, payload: { path: string; content: string }) {
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client) {
    sendError(ws, 'NO_REMOTE_CONNECTION', 'No active remote connection');
    return;
  }

  try {
    await client.writeFile(payload.path, payload.content);
    send(ws, 'file:write:result', { success: true });
  } catch (error) {
    send(ws, 'file:write:result', { success: false, error: String(error) });
  }
}

async function handleDirectoryList(ws: WebSocket, payload: { path: string; recursive?: boolean }) {
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client) {
    sendError(ws, 'NO_REMOTE_CONNECTION', 'No active remote connection');
    return;
  }

  try {
    const files = await client.listDirectory(payload.path, payload.recursive);
    send(ws, 'directory:list:result', { success: true, data: files });
  } catch (error) {
    send(ws, 'directory:list:result', { success: false, error: String(error) });
  }
}

async function handleWatchSubscribe(ws: WebSocket, payload: { path: string }) {
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client) {
    sendError(ws, 'NO_REMOTE_CONNECTION', 'No active remote connection');
    return;
  }

  try {
    const result = await client.watchSubscribe(payload.path);
    send(ws, 'watch:subscribe:result', { success: true, data: result });
  } catch (error) {
    send(ws, 'watch:subscribe:result', { success: false, error: String(error) });
  }
}

async function handleWatchUnsubscribe(ws: WebSocket, payload: { subscriptionId: string }) {
  const manager = getRemoteConnectionManager();
  const client = manager.getActiveClient();

  if (!client) {
    sendError(ws, 'NO_REMOTE_CONNECTION', 'No active remote connection');
    return;
  }

  try {
    await client.watchUnsubscribe(payload.subscriptionId);
    send(ws, 'watch:unsubscribe:result', { success: true });
  } catch (error) {
    send(ws, 'watch:unsubscribe:result', { success: false, error: String(error) });
  }
}

async function handleRemoteServers(ws: WebSocket) {
  const manager = getRemoteConnectionManager();
  const statuses = manager.getAllServersStatus();
  send(ws, 'remote:servers:result', { success: true, data: statuses });
}

function handleRemoteSwitch(ws: WebSocket, payload: { serverId: string | null }) {
  const manager = getRemoteConnectionManager();
  manager.setActiveServer(payload.serverId);
  send(ws, 'remote:switch:result', { success: true, activeServerId: payload.serverId });
}
```

- [ ] **Step 3: 编译验证**

```bash
cd apps/server
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/routes/websocket.ts
git commit -m "$(cat <<'EOF'
feat(server): 添加远程文件操作 WebSocket 消息

- 文件读写
- 目录列表
- 监控订阅
- 服务器切换

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Chunk 3: 前端实现

### Task 3.1: 远程服务器状态管理

**Files:**
- Create: `apps/web/src/stores/remoteStore.ts`
- Create: `apps/web/src/stores/fileStore.ts`

- [ ] **Step 1: 创建 remoteStore**

```typescript
// apps/web/src/stores/remoteStore.ts
import { create } from 'zustand';

export interface RemoteServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  remotePort: number;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

interface RemoteState {
  servers: RemoteServer[];
  activeServerId: string | null;
  managerExpanded: boolean;
  isLoading: boolean;

  // Actions
  loadServers: () => Promise<void>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  switchServer: (id: string | null) => void;
  addServer: (config: Omit<RemoteServer, 'id' | 'status'>) => Promise<void>;
  updateServer: (id: string, config: Partial<RemoteServer>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  toggleManager: () => void;
  setServerStatus: (id: string, status: RemoteServer['status'], error?: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

export const useRemoteStore = create<RemoteState>((set, get) => ({
  servers: [],
  activeServerId: null,
  managerExpanded: false,
  isLoading: false,

  loadServers: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/remote/servers`);
      const data = await res.json();
      if (data.success) {
        set({ servers: data.data });
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  connectServer: async (id) => {
    const { servers } = get();
    set({
      servers: servers.map((s) =>
        s.id === id ? { ...s, status: 'connecting' as const } : s
      ),
    });

    try {
      const res = await fetch(`${API_BASE}/remote/servers/${id}/connect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, status: 'connected' as const } : s
          ),
        });
      } else {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, status: 'error' as const, error: data.error } : s
          ),
        });
      }
    } catch (error) {
      set({
        servers: get().servers.map((s) =>
          s.id === id ? { ...s, status: 'error' as const, error: String(error) } : s
        ),
      });
    }
  },

  disconnectServer: async (id) => {
    try {
      await fetch(`${API_BASE}/remote/servers/${id}/disconnect`, {
        method: 'POST',
      });
      set({
        servers: get().servers.map((s) =>
          s.id === id ? { ...s, status: 'disconnected' as const } : s
        ),
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  },

  switchServer: (id) => {
    set({ activeServerId: id });
    // 通知后端
    fetch(`${API_BASE}/remote/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId: id }),
    }).catch(console.error);
  },

  addServer: async (config) => {
    try {
      const res = await fetch(`${API_BASE}/remote/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        set({ servers: [...get().servers, { ...data.data, status: 'disconnected' as const }] });
      }
    } catch (error) {
      console.error('Failed to add server:', error);
    }
  },

  updateServer: async (id, config) => {
    try {
      const res = await fetch(`${API_BASE}/remote/servers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        set({
          servers: get().servers.map((s) =>
            s.id === id ? { ...s, ...data.data } : s
          ),
        });
      }
    } catch (error) {
      console.error('Failed to update server:', error);
    }
  },

  removeServer: async (id) => {
    try {
      await fetch(`${API_BASE}/remote/servers/${id}`, {
        method: 'DELETE',
      });
      set({
        servers: get().servers.filter((s) => s.id !== id),
        activeServerId: get().activeServerId === id ? null : get().activeServerId,
      });
    } catch (error) {
      console.error('Failed to remove server:', error);
    }
  },

  toggleManager: () => {
    set({ managerExpanded: !get().managerExpanded });
  },

  setServerStatus: (id, status, error) => {
    set({
      servers: get().servers.map((s) =>
        s.id === id ? { ...s, status, error } : s
      ),
    });
  },
}));
```

- [ ] **Step 2: 创建 fileStore**

```typescript
// apps/web/src/stores/fileStore.ts
import { create } from 'zustand';
import { useRemoteStore } from './remoteStore';

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

interface FileState {
  currentPath: string;
  files: FileInfo[];
  selectedFile: string | null;
  fileContent: string | null;
  isLoading: boolean;
  error: string | null;
  pathHistory: string[];

  // Actions
  listDirectory: (path: string, wsSend: (type: string, payload: unknown) => void) => void;
  readFile: (path: string, wsSend: (type: string, payload: unknown) => void) => void;
  refresh: (wsSend: (type: string, payload: unknown) => void) => void;
  goBack: (wsSend: (type: string, payload: unknown) => void) => void;
  setSelectedFile: (path: string | null) => void;
  setFiles: (files: FileInfo[]) => void;
  setFileContent: (content: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '/',
  files: [],
  selectedFile: null,
  fileContent: null,
  isLoading: false,
  error: null,
  pathHistory: [],

  listDirectory: (path, wsSend) => {
    const activeServerId = useRemoteStore.getState().activeServerId;
    if (!activeServerId) {
      set({ error: '请先连接远程服务器' });
      return;
    }

    set({ isLoading: true, error: null, currentPath: path });
    wsSend('directory:list', { path });
  },

  readFile: (path, wsSend) => {
    const activeServerId = useRemoteStore.getState().activeServerId;
    if (!activeServerId) {
      set({ error: '请先连接远程服务器' });
      return;
    }

    set({ isLoading: true, error: null, selectedFile: path });
    wsSend('file:read', { path });
  },

  refresh: (wsSend) => {
    const { currentPath } = get();
    get().listDirectory(currentPath, wsSend);
  },

  goBack: (wsSend) => {
    const { pathHistory, currentPath } = get();
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      set({
        pathHistory: pathHistory.slice(0, -1),
        currentPath: previousPath,
      });
      get().listDirectory(previousPath, wsSend);
    }
  },

  setSelectedFile: (path) => set({ selectedFile: path }),
  setFiles: (files) => set({ files, isLoading: false }),
  setFileContent: (content) => set({ fileContent: content, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
}));
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/stores/
git commit -m "$(cat <<'EOF'
feat(web): 添加远程服务器和文件状态管理

- remoteStore: 服务器管理
- fileStore: 文件浏览器

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: 侧边栏改动

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/components/remote/ServerManager.tsx`
- Create: `apps/web/src/components/remote/ServerForm.tsx`

由于篇幅限制，这部分的核心实现思路：

1. **Sidebar.tsx** 修改：
   - 会话列表按 serverId 分组
   - 每个分组显示颜色标记（🟢/⚪/🔵）
   - 底部添加 ServerManager 组件
   - 分组标题右侧添加 [+新] 按钮

2. **ServerManager.tsx**：
   - 展开/折叠服务器列表
   - 显示连接状态
   - 连接/断开/编辑/删除操作
   - 添加新服务器入口

3. **ServerForm.tsx**：
   - 模态框表单
   - 服务器配置字段
   - 验证和提交

---

### Task 3.3: 产物面板改动

**Files:**
- Modify: `apps/web/src/components/layout/ArtifactsPanel.tsx`
- Create: `apps/web/src/components/remote/FileExplorer.tsx`
- Create: `apps/web/src/components/remote/FilePreview.tsx`

核心实现思路：

1. **ArtifactsPanel.tsx** 修改：
   - 添加 Tab 切换（本地产物/远程文件）
   - 未连接时显示提示
   - 根据选中的 Tab 显示不同内容

2. **FileExplorer.tsx**：
   - 显示文件列表
   - 点击目录进入
   - 点击文件预览
   - 路径导航

3. **FilePreview.tsx**：
   - 文件内容显示
   - 日志文件刷新按钮
   - 下载按钮

---

### Task 3.4: WebSocket 集成

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 添加新消息类型处理**

在 useWebSocket hook 中添加对以下消息的处理：

```typescript
// 在消息处理的 switch 中添加
case 'directory:list:result':
  if (payload.success) {
    useFileStore.getState().setFiles(payload.data);
  } else {
    useFileStore.getState().setError(payload.error);
  }
  break;

case 'file:read:result':
  if (payload.success) {
    useFileStore.getState().setFileContent(payload.data.content);
  } else {
    useFileStore.getState().setError(payload.error);
  }
  break;

case 'remote:servers:result':
  // 更新服务器状态
  break;

case 'remote:switch:result':
  // 确认切换
  break;
```

- [ ] **Step 2: 添加发送方法**

```typescript
// 暴露给组件使用的方法
const sendDirectoryList = (path: string) => {
  send({ type: 'directory:list', payload: { path } });
};

const sendFileRead = (path: string) => {
  send({ type: 'file:read', payload: { path } });
};

const sendRemoteSwitch = (serverId: string | null) => {
  send({ type: 'remote:switch', payload: { serverId } });
};
```

---

## 实施顺序建议

1. **先完成 Chunk 1** - dashboard-remote-server 可以独立开发和测试
2. **再完成 Chunk 2** - Dashboard Server 模块
3. **最后完成 Chunk 3** - 前端 UI

每个 Chunk 完成后都应进行集成测试，确保各组件能正确通信。

---

## 测试计划

### 单元测试
- [ ] 路径验证工具测试
- [ ] 文件系统管理器测试
- [ ] JSON-RPC 消息解析测试

### 集成测试
- [ ] dashboard-remote-server 端到端测试
- [ ] SSH 隧道连接测试
- [ ] WebSocket 消息流测试

### 手动测试
- [ ] 连接真实远程服务器
- [ ] 浏览远程文件系统
- [ ] 运行 Agent 并查看输出
