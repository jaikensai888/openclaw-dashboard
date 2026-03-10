# Dashboard Plugin 部署指南

本文档详细介绍如何部署 dashboard-plugin 到 Openclaw 环境。

## 目录

- [前置条件](#前置条件)
- [快速部署](#快速部署)
- [详细步骤](#详细步骤)
- [配置验证](#配置验证)
- [常见问题](#常见问题)

---

## 前置条件

| 组件 | 要求 | 检查命令 |
|------|------|----------|
| Openclaw | >= 2024.1 | `openclaw --version` |
| Node.js | >= 18.0.0 | `node --version` |
| pnpm | >= 8.0.0 | `pnpm --version` |

---

## 快速部署

```bash
# 1. 构建 plugin
cd openclaw-dashboard
pnpm build

# 2. 打包 plugin
cd packages/dashboard-plugin
pnpm pack

# 3. 安装到 Openclaw
openclaw plugins install ./openclaw-dashboard-dashboard-plugin-1.0.0.tgz

# 4. 配置并重启
# 编辑 ~/.openclaw/openclaw.json（见下方配置）
openclaw daemon restart
```

---

## 详细步骤

### Step 1: 构建 Dashboard Backend

```bash
cd openclaw-dashboard

# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### Step 2: 构建 Dashboard Plugin

```bash
cd packages/dashboard-plugin

# 构建 plugin
pnpm build

# 打包为 tgz
pnpm pack
# 生成: openclaw-dashboard-dashboard-plugin-1.0.0.tgz
```

### Step 3: 安装 Plugin 到 Openclaw

```bash
# 方式一：从 tgz 文件安装
openclaw plugins install /path/to/openclaw-dashboard-dashboard-plugin-1.0.0.tgz

# 方式二：从目录安装（开发调试）
cd packages/dashboard-plugin
openclaw plugins install .
```

### Step 4: 配置 Openclaw

#### 4.1 配置 channels

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "dashboard": {
      "enabled": true,
      "backendUrl": "http://192.168.0.74:3001",
      "pluginToken": ""
    }
  },
  "plugins": {
    "entries": {
      "dashboard-plugin": {
        "enabled": true,
        "config": {
          "backendUrl": "http://192.168.0.74:3001",
          "pluginToken": "",
          "name": "My Dashboard"
        }
      }
    }
  }
}
```

**配置说明：**

| 参数 | 说明 |
|------|------|
| `backendUrl` | Dashboard Backend 地址（不带 /ws/plugin 后缀） |
| `pluginToken` | 认证 Token（需与 Backend PLUGIN_TOKEN 一致，为空则不验证） |
| `name` | 显示名称（可选） |

#### 4.2 配置 Agent Provider（重要！）

**这是最关键的配置步骤，配置不当会导致 Agent 无法响应。**

编辑 `~/.openclaw/agents/main/agent/models.json`：

```json
{
  "providers": {
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
      ],
      "apiKey": "YOUR_MINIMAX_API_KEY"
    }
  }
}
```

编辑 `~/.openclaw/agents/main/agent/auth-profiles.json`：

```json
{
  "version": 1,
  "profiles": {
    "minimax-cn:default": {
      "type": "api_key",
      "provider": "minimax-cn",
      "key": "YOUR_MINIMAX_API_KEY"
    }
  }
}
```

**Provider 配置要点：**

1. `models.json` 中的 provider 名称必须与 `auth-profiles.json` 中的 `provider` 字段一致
2. API Key 必须正确且有效
3. `baseUrl` 必须正确指向 API 端点

**常用 Provider 配置：**

| Provider | baseUrl | api 类型 |
|----------|---------|----------|
| Anthropic | `https://api.anthropic.com` | `anthropic-messages` |
| MiniMax 国内 | `https://api.minimaxi.com/anthropic` | `anthropic-messages` |
| MiniMax 国际 | `https://api.minimax.io/anthropic` | `anthropic-messages` |
| 智谱 GLM | `https://open.bigmodel.cn/api/coding/paas/v4` | `openai-completions` |

#### 4.3 配置默认模型

编辑 `~/.openclaw/openclaw.json`，确保 `agents.defaults.model` 正确：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "minimax-cn/MiniMax-M2.5",
        "fallbacks": ["minimax/MiniMax-M2.5-highspeed"]
      }
    }
  }
}
```

### Step 5: 启动服务

```bash
# 启动 Dashboard Backend
cd openclaw-dashboard/apps/server
pnpm dev
# 或生产环境: pnpm start

# 重启 Openclaw 服务
openclaw daemon restart
```

---

## 配置验证

### 检查 Plugin 安装

```bash
openclaw plugins list
# 应显示 dashboard-plugin

# 检查 agent 配置
openclaw agents list
# 应显示 Model: provider/model-name
```

### 检查日志

```bash
# 实时查看日志
openclaw logs --follow

# 查找关键信息
openclaw logs --follow | grep -i "dashboard\|plugin\|provider"
```

**正常日志应包含：**
```
[dashboard-plugin] Connecting to http://...
[dashboard-plugin] Connected successfully
agent model: minimax-cn/MiniMax-M2.5
```

### 测试响应

通过 Dashboard 发送消息，检查 Agent 是否正常响应。

---

## 常见问题

### Q1: "No API key found for provider"

**错误信息：**
```
Agent failed before reply: No API key found for provider "anthropic"
```

**原因：** `auth-profiles.json` 中缺少对应 provider 的配置，或 `provider` 字段不匹配。

**解决方案：**

1. 检查 `auth-profiles.json` 中是否有对应的 profile
2. 确认 `provider` 字段与 models.json 中定义一致
3. 如果使用 Anthropic 兼容 API，确保添加 `anthropic:default` profile

```json
// auth-profiles.json
{
  "profiles": {
    "anthropic:default": {
      "type": "api_key",
      "provider": "anthropic",  // 必须匹配
      "key": "your-api-key"
    }
  }
}
```

### Q2: "HTTP 401: authentication_error"

**错误信息：**
```
HTTP 401: authentication_error: invalid x-api-key
```

**原因：** API Key 无效或不匹配。

**解决方案：**

1. 确认 API Key 正确
2. 确认 API Key 对应正确的 Provider（如智谱的 key 不能用于 Anthropic 官方 API）

### Q3: Plugin 无法连接 Backend

**症状：** Dashboard 发送消息无响应，日志显示连接失败

**排查步骤：**

```bash
# 1. 检查 Backend 是否运行
curl http://localhost:3001/health

# 2. 检查配置中的 backendUrl
cat ~/.openclaw/openclaw.json | jq '.channels.dashboard'

# 3. 检查网络连通性
ping 192.168.0.74
```

### Q4: 配置修改后不生效

**解决方案：**

```bash
# 重启 Openclaw 服务
openclaw daemon restart

# 等待几秒后检查状态
openclaw daemon status
```

---

## 文件结构参考

完整的 Openclaw 配置文件结构：

```
~/.openclaw/
├── openclaw.json                    # 主配置
├── agents/
│   └── main/
│       └── agent/
│           ├── auth-profiles.json   # API Key 认证
│           └── models.json          # Provider 定义
└── extensions/
    └── dashboard-plugin/            # Plugin 安装目录
        ├── index.ts
        └── package.json
```

---

## 相关文档

- [配置指南](./CONFIGURATION_GUIDE.md) - 完整配置参考
- [README](../README.md) - 项目概述
