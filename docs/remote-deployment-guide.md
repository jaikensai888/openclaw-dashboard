# OpenClaw Dashboard 远程部署操作指南

## 1. 配置 Gateway 监听局域网

编辑 `~/.openclaw/openclaw.json`，设置 `gateway.bind: "lan"`：

```json
{
  "gateway": {
    "mode": "local",
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "clawx-xxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

- `bind: "lan"` — 监听 `0.0.0.0:18789`，局域网可访问
- `bind: "local"` — 仅监听 `127.0.0.1:18789`（默认）

重启 Gateway 并确认：

```bash
openclaw gateway restart
ss -tlnp | grep 18789
```

## 2. 审批设备密钥

Dashboard 首次连接时需审批设备密钥。

**获取设备 ID**（在 Dashboard 客户端机器上）：

```bash
cat ~/.openclaw/identity/device.json | grep deviceId
```

**审批设备**（在 Gateway 服务器上）：

```bash
openclaw devices approve <deviceId>
```

**撤销设备**：

```bash
openclaw devices revoke <deviceId>
```

**查看已审批设备**：

```bash
openclaw devices list
```
