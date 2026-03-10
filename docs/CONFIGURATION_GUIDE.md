# Openclaw Dashboard 配置指南

本文档详细说明如何配置 Openclaw Dashboard 系统，包括前端、后端和 Openclaw 插件。

## 目录

- [系统架构](#系统架构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [Dashboard Backend 配置](#dashboard-backend-配置)
- [Dashboard 前端配置](#dashboard-前端配置)
- [Openclaw 插件配置](#openclaw-插件配置)
- [安全配置](#安全配置)
- [部署指南](#部署指南)
- [故障排除](#故障排除)

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户浏览器                                        │
│                         http://your-domain:3000                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket + HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Dashboard Backend                                   │
│                        (Fastify + SQLite)                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ REST API     │  │ WebSocket    │  │ 消息解析器    │  │ 任务管理器    │    │
│  │ :3001/api/v1 │  │ :3001/ws     │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         SQLite 数据库                                 │  │
│  │  conversations | messages | tasks | task_outputs                     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (Plugin)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Openclaw Server                                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Dashboard Plugin                                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Channel    │  │ Gateway    │  │ Outbound   │  │ Config     │     │  │
│  │  │ Plugin     │  │ (WebSocket)│  │ (消息发送)  │  │ Resolver   │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Openclaw Agent                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 环境要求

### 必需

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18.0.0 | 推荐使用 LTS 版本 |
| pnpm | >= 8.0.0 | 包管理器 |
| Openclaw | >= 2024.1 | AI Agent 框架 |

### 可选

| 组件 | 说明 |
|------|------|
| PM2 | 进程管理（生产环境推荐） |
| Nginx | 反向代理 |
| Docker | 容器化部署 |

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-org/openclaw-dashboard.git
cd openclaw-dashboard
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# 编辑配置文件
nano apps/server/.env
nano apps/web/.env.local
```

### 4. 启动服务

```bash
# 同时启动前后端
pnpm dev

# 或分别启动
pnpm dev:server  # 后端 :3001
pnpm dev:web     # 前端 :3000
```

### 5. 验证安装

- 后端健康检查: http://localhost:3001/health
- 前端界面: http://localhost:3000

---

## Dashboard Backend 配置

### 配置文件位置

```
apps/server/.env
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 3001 | 服务端口 |
| `HOST` | 否 | 0.0.0.0 | 监听地址 |
| `DB_PATH` | 否 | ./data/dashboard.db | SQLite 数据库路径 |
| `PLUGIN_TOKEN` | 否 | - | 插件认证 Token |
| `LOG_LEVEL` | 否 | info | 日志级别 |

### 配置示例

```bash
# apps/server/.env

# 服务配置
PORT=3001
HOST=0.0.0.0

# 数据库配置
DB_PATH=./data/dashboard.db

# 安全配置
PLUGIN_TOKEN=your-secure-random-token-here

# 日志配置
LOG_LEVEL=info
```

### API 端点

#### HTTP REST

```
基础 URL: http://localhost:3001/api/v1
```

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /conversations | 获取会话列表 |
| POST | /conversations | 创建新会话 |
| GET | /conversations/:id | 获取会话详情 |
| PATCH | /conversations/:id | 更新会话 |
| DELETE | /conversations/:id | 删除会话 |
| GET | /conversations/:id/messages | 获取消息列表 |
| POST | /conversations/:id/messages | 创建消息 |
| GET | /tasks/:id | 获取任务详情 |
| POST | /tasks/:id/cancel | 取消任务 |

#### WebSocket

| 端点 | 说明 |
|------|------|
| /ws | 前端客户端连接 |
| /ws/plugin | Openclaw 插件连接 |

---

## Dashboard 前端配置

### 配置文件位置

```
apps/web/.env.local
```

### 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `NEXT_PUBLIC_API_URL` | 否 | http://localhost:3001/api/v1 | 后端 API 地址 |
| `NEXT_PUBLIC_WS_URL` | 否 | ws://localhost:3001/ws | WebSocket 地址 |

### 配置示例

```bash
# apps/web/.env.local

# 后端服务地址
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
```

### 生产环境配置

```bash
# apps/web/.env.production

NEXT_PUBLIC_API_URL=https://api.your-domain.com/api/v1
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws
```

---

## Openclaw 插件配置

### 安装方式

#### 方式一：从源码安装（开发推荐）

```bash
# 进入插件目录
cd openclaw-dashboard/packages/dashboard-plugin

# 使用 Openclaw CLI 安装（安装到 extensions 目录）
openclaw plugins install .
```

#### 方式二：npm 包（发布后）

```bash
cd /path/to/openclaw
openclaw plugins install @openclaw-dashboard/dashboard-plugin
```

#### 方式三：符号链接（本地开发调试）

```bash
# 创建符号链接到 Openclaw extensions 目录
ln -s $(pwd)/packages/dashboard-plugin ~/.openclaw/extensions/dashboard
```

### Openclaw 配置

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "dashboard": {
      "enabled": true,
      "backendUrl": "ws://localhost:3001/ws/plugin",
      "pluginToken": "your-secure-random-token-here",
      "name": "My Dashboard"
    }
  }
}
```

**参数说明：**
- `enabled`: 是否启用插件，默认 `true`
- `backendUrl`: Dashboard Backend WebSocket URL（必填，注意使用 `/ws/plugin` 端点）
- `pluginToken`: 认证 Token（可选，需与 Backend `PLUGIN_TOKEN` 一致）
- `name`: 显示名称（可选）

### 多账户配置

如果需要连接多个 Dashboard 后端：

```json
{
  "channels": {
    "dashboard": {
      "enabled": true,
      "backendUrl": "ws://default-server:3001/ws/plugin",
      "pluginToken": "default-token",
      "name": "Default Dashboard",

      "accounts": {
        "work": {
          "backendUrl": "ws://work-server:3001/ws/plugin",
          "pluginToken": "work-token",
          "name": "Work Dashboard"
        },
        "personal": {
          "backendUrl": "ws://personal-server:3001/ws/plugin",
          "pluginToken": "personal-token",
          "name": "Personal Dashboard"
        }
      }
    }
  }
}
```

### 环境变量配置

也可以通过环境变量设置：

```bash
# /etc/environment 或 ~/.bashrc

DASHBOARD_BACKEND_URL="ws://localhost:3001/ws/plugin"
DASHBOARD_PLUGIN_TOKEN="your-token"
```

配置优先级：
1. `~/.openclaw/openclaw.json` 中的配置
2. 环境变量
3. 默认值

### 配置参数详解

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `enabled` | boolean | 否 | 是否启用插件，默认 `true` |
| `backendUrl` | string | **是** | Dashboard Backend WebSocket URL |
| `pluginToken` | string | 否 | 认证 Token |
| `name` | string | 否 | 连接显示名称 |

### 验证插件状态

```bash
# 查看 Openclaw 日志
tail -f /path/to/openclaw/logs/openclaw.log | grep -i dashboard

# 应看到类似输出：
# [Dashboard] Connecting to ws://localhost:3001/ws/plugin
# [Dashboard] Connected successfully
# [Dashboard] Authenticated as: default
```

---

## 安全配置

### 生成安全 Token

```bash
# 使用 openssl 生成随机 Token
openssl rand -hex 32

# 或使用 node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Token 配置

1. **Dashboard Backend** (`apps/server/.env`)：
   ```bash
   PLUGIN_TOKEN=生成的token
   ```

2. **Openclaw** (`~/.openclaw/openclaw.json`)：
   ```json
   {
     "channels": {
       "dashboard": {
         "pluginToken": "相同的token"
       }
     }
   }
   ```

### 网络安全

#### 使用 HTTPS/WSS

推荐在生产环境使用反向代理（如 Nginx）配置 SSL：

```nginx
# /etc/nginx/sites-available/dashboard

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### 防火墙配置

```bash
# 仅允许本地访问（使用反向代理时）
# 修改 apps/server/.env
HOST=127.0.0.1
```

---

## 部署指南

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 创建配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'dashboard-server',
      cwd: './apps/server',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'dashboard-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
EOF

# 启动服务
pm2 start ecosystem.config.js

# 保存配置
pm2 save
pm2 startup
```

### 构建 Docker 镜像

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages
COPY apps apps

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/server/dist ./server
COPY --from=builder /app/apps/web/.next ./web
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "server/index.js"]
```

---

## 故障排除

### 常见问题

#### 1. WebSocket 连接失败

**症状**：前端显示"连接断开"或消息无法发送

**检查**：
```bash
# 检查后端是否运行
curl http://localhost:3001/health

# 检查 WebSocket 端点
wscat -c ws://localhost:3001/ws
```

**解决方案**：
- 确认后端服务正在运行
- 检查防火墙设置
- 确认 WebSocket URL 正确

#### 2. 插件认证失败

**症状**：Openclaw 日志显示 "Invalid token"

**检查**：
```bash
# 确认 Token 配置一致
grep PLUGIN_TOKEN apps/server/.env
grep pluginToken ~/.openclaw/openclaw.json
```

**解决方案**：
- 确保 Token 完全一致（区分大小写）
- 检查是否有额外空格

#### 3. 数据库错误

**症状**：SQL 错误或数据无法保存

**检查**：
```bash
# 检查数据库文件权限
ls -la apps/server/data/

# 检查数据库完整性
sqlite3 apps/server/data/dashboard.db "PRAGMA integrity_check;"
```

**解决方案**：
- 确保数据目录可写
- 检查磁盘空间

#### 4. 前端无法连接后端

**症状**：页面加载但无数据显示

**检查**：
```bash
# 检查前端环境变量
cat apps/web/.env.local

# 测试 API 连接
curl http://localhost:3001/api/v1/conversations
```

**解决方案**：
- 确认 `NEXT_PUBLIC_API_URL` 和 `NEXT_PUBLIC_WS_URL` 正确
- 检查 CORS 配置

### 日志查看

```bash
# 后端日志
tail -f apps/server/logs/app.log

# PM2 日志
pm2 logs dashboard-server

# Openclaw 日志
tail -f /path/to/openclaw/logs/openclaw.log | grep -i dashboard
```

### 调试模式

```bash
# 启用详细日志
# apps/server/.env
LOG_LEVEL=debug
```

---

## 附录

### 任务协议标记

Agent 通过内联标记报告任务状态：

```
[TASK:START:type:title]      # 开始任务
[TASK:PROGRESS:percent:msg]   # 更新进度 (0-100)
[TASK:DONE]                   # 完成任务
[TASK:FAILED:error]           # 任务失败
```

任务类型：
- `research` - 研究任务
- `code` - 代码任务
- `file` - 文件操作
- `command` - 命令执行
- `custom` - 自定义任务

### WebSocket 消息格式

#### 前端 → 后端

```json
// 创建会话
{"type": "conversation.create", "payload": {"title": "新会话"}}

// 切换会话
{"type": "conversation.switch", "payload": {"conversationId": "conv_xxx"}}

// 发送消息
{"type": "chat.send", "payload": {"conversationId": "conv_xxx", "content": "你好"}}

// 取消任务
{"type": "task.cancel", "payload": {"taskId": "task_xxx"}}
```

#### 后端 → 前端

```json
// 连接成功
{"type": "connected", "payload": {"message": "Connected to Dashboard Backend"}}

// 会话创建
{"type": "conversation.created", "payload": {"id": "conv_xxx", "title": "新会话", ...}}

// 聊天消息
{"type": "chat.message", "payload": {"id": "msg_xxx", "role": "user", "content": "...", ...}}

// 流式输出
{"type": "chat.streaming", "payload": {"conversationId": "conv_xxx", "delta": "文本", "done": false}}

// 任务状态
{"type": "task.created", "payload": {"id": "task_xxx", "type": "code", ...}}
{"type": "task.updated", "payload": {"taskId": "task_xxx", "progress": 50, ...}}
{"type": "task.completed", "payload": {"id": "task_xxx", ...}}
{"type": "task.failed", "payload": {"taskId": "task_xxx", "error": "..."}}
```

---

---

## Openclaw Agent 配置（重要）

Dashboard 插件依赖 Openclaw Agent 正确配置 AI Provider。如果配置不当，会出现以下错误：

```
Agent failed before reply: No API key found for provider "anthropic"
```

### Agent 配置文件位置

```
~/.openclaw/
├── openclaw.json              # 主配置文件
└── agents/
    └── main/
        └── agent/
            ├── auth-profiles.json   # API Key 认证配置
            └── models.json          # Provider 和模型定义
```

### 配置步骤

#### 1. 配置 Provider (models.json)

编辑 `~/.openclaw/agents/main/agent/models.json`，添加你的 AI Provider：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://api.anthropic.com",
      "api": "anthropic-messages",
      "models": [
        {
          "id": "claude-sonnet-4-6",
          "name": "Claude Sonnet 4.6",
          "reasoning": true,
          "input": ["text", "image"],
          "contextWindow": 200000,
          "maxTokens": 8192
        }
      ]
    },
    "minimax-cn": {
      "baseUrl": "https://api.minimaxi.com/anthropic",
      "api": "anthropic-messages",
      "authHeader": true,
      "models": [
        {
          "id": "MiniMax-M2.5",
          "name": "MiniMax M2.5",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 8192
        }
      ]
    },
    "zai": {
      "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
      "api": "openai-completions",
      "models": [
        {
          "id": "glm-5",
          "name": "GLM-5",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 204800,
          "maxTokens": 131072
        }
      ]
    }
  }
}
```

**常用 Provider 配置示例：**

| Provider | baseUrl | api |
|----------|---------|-----|
| Anthropic 官方 | `https://api.anthropic.com` | `anthropic-messages` |
| MiniMax 国际 | `https://api.minimax.io/anthropic` | `anthropic-messages` |
| MiniMax 国内 | `https://api.minimaxi.com/anthropic` | `anthropic-messages` |
| 智谱 GLM | `https://open.bigmodel.cn/api/coding/paas/v4` | `openai-completions` |
| Kimi Coding | `https://api.kimi.com/coding/` | `anthropic-messages` |

#### 2. 配置 API Key (auth-profiles.json)

编辑 `~/.openclaw/agents/main/agent/auth-profiles.json`：

```json
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "api_key",
      "provider": "anthropic",
      "key": "sk-ant-your-anthropic-key"
    },
    "minimax-cn:default": {
      "type": "api_key",
      "provider": "minimax-cn",
      "key": "sk-cp-your-minimax-key"
    },
    "zai:default": {
      "type": "api_key",
      "provider": "zai",
      "key": "your-zhipu-key"
    }
  }
}
```

**重要说明：**
- Profile ID 格式：`{provider}:default`
- `provider` 字段必须与 `models.json` 中的 provider 名称一致
- `key` 是你的实际 API Key

#### 3. 配置默认模型 (openclaw.json)

编辑 `~/.openclaw/openclaw.json`，设置默认模型：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax-cn/MiniMax-M2.5",
        "fallbacks": [
          "zai/glm-5",
          "anthropic/claude-sonnet-4-6"
        ]
      }
    }
  }
}
```

模型格式：`{provider}/{model_id}`

#### 4. 重启 Openclaw 服务

```bash
openclaw daemon restart
```

### 使用 Anthropic 兼容 API

如果你想使用非 Anthropic 官方的 API（如 MiniMax、Kimi 等）但保持 `anthropic` provider 名称，可以创建一个代理配置：

```json
// models.json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://api.minimaxi.com/anthropic",
      "api": "anthropic-messages",
      "authHeader": true,
      "models": [
        {
          "id": "MiniMax-M2.5",
          "name": "MiniMax M2.5 (via Anthropic)",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

```json
// auth-profiles.json
{
  "profiles": {
    "anthropic:default": {
      "type": "api_key",
      "provider": "anthropic",
      "key": "your-minimax-api-key"
    }
  }
}
```

### 验证配置

```bash
# 检查 agent 列表和模型
openclaw agents list

# 应显示类似：
# Model: minimax-cn/MiniMax-M2.5

# 查看日志
openclaw logs --follow | grep -i "api key\|provider\|model"
```

### 常见配置错误

#### 错误 1: provider 不匹配

**症状**：`No API key found for provider "anthropic"`

**原因**：`auth-profiles.json` 中的 `provider` 字段与实际请求的 provider 不一致

**解决**：确保 `provider` 字段正确

```json
// ❌ 错误
"anthropic:default": {
  "provider": "zai",  // 错误！应该是 "anthropic"
  "key": "..."
}

// ✅ 正确
"anthropic:default": {
  "provider": "anthropic",
  "key": "..."
}
```

#### 错误 2: API Key 无效

**症状**：`HTTP 401: authentication_error: invalid x-api-key`

**原因**：使用了错误的 API Key（如将智谱的 key 用于 Anthropic 官方 API）

**解决**：
1. 确认使用正确的 API Key
2. 或配置使用兼容 API（见上方"使用 Anthropic 兼容 API"）

#### 错误 3: models.json 缺少 provider

**症状**：模型无法加载，fallback 失败

**解决**：确保 `models.json` 中定义了所有需要使用的 provider

---

## 联系支持

如有问题，请：
1. 查阅本文档
2. 查看日志文件
3. 提交 Issue: https://github.com/your-org/openclaw-dashboard/issues
