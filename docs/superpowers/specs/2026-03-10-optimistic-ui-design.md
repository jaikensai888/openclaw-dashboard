# 乐观更新 UI 设计

## 概述

改进聊天消息发送体验，实现乐观更新（Optimistic UI）：用户发送消息后立即显示在列表中，无需等待服务器返回。

## 问题

当前发送消息流程：
1. 用户输入 → 点击发送
2. 等待服务器处理
3. 服务器广播消息
4. 消息才显示在界面

用户体验差，感觉响应慢。

## 解决方案

### 流程

1. 用户发送消息 → 立即显示在列表中（乐观更新）
2. 消息带有 `pending` 状态标识
3. 服务器确认后 → 移除 pending 状态
4. 失败时 → 显示错误状态 + 重试按钮

### 文件变更

#### 1. Store (`apps/web/src/stores/chatStore.ts`)

**Message 接口扩展：**
```typescript
interface Message {
  // 现有字段...
  status?: 'pending' | 'sent' | 'failed';
  error?: string;
}
```

**新增 actions：**
- `addPendingMessage(conversationId, content)` - 立即添加本地消息，返回临时 ID
- `confirmMessage(tempId, serverMessage)` - 服务器确认后替换临时消息
- `failMessage(tempId, error)` - 标记消息发送失败
- `retryMessage(tempId)` - 重试发送失败的消息

#### 2. MessageItem (`apps/web/src/components/chat/MessageItem.tsx`)

**状态显示：**
- `pending`：右上角显示小加载动画
- `failed`：红色左边框 + 错误提示 + 重试按钮

#### 3. InputBar (`apps/web/src/components/chat/InputBar.tsx`)

- 发送后立即清空输入框
- 调用 `addPendingMessage` 添加本地消息

#### 4. useWebSocket (`apps/web/src/hooks/useWebSocket.ts`)

**sendMessage 改造：**
```typescript
const sendMessage = (conversationId: string, content: string) => {
  // 1. 先添加本地消息
  const tempId = store.addPendingMessage(conversationId, content);

  // 2. 发送到服务器（带上 tempId）
  send('chat.send', { conversationId, content, tempId });
};
```

**消息确认处理：**
```typescript
case 'chat.message': {
  const msg = payload as Message;

  // 如果是确认我们发送的消息
  if (msg.tempId && pendingMessages[msg.tempId]) {
    store.confirmMessage(msg.tempId, msg);
  } else {
    // 其他消息正常添加
    store.addMessage(msg.conversationId, msg);
  }
}
```

#### 5. 后端 WebSocket (`apps/server/src/routes/websocket.ts`)

**chat.message 广播时携带 tempId：**
```typescript
broadcast('chat.message', {
  ...messageData,
  tempId: payload.tempId, // 回传给前端用于匹配
});
```

### UI 设计

**Pending 状态：**
```
┌─────────────────────────────────┐
│ 用户消息内容...          ● ↻   │  ← 右上角小加载动画
└─────────────────────────────────┘
```

**Failed 状态：**
```
┌─────────────────────────────────┐
│▌用户消息内容...                 │  ← 红色左边框
│▌发送失败 [重试]                 │  ← 错误提示 + 重试按钮
└─────────────────────────────────┘
```

### 错误处理

1. WebSocket 断开时，pending 消息自动标记为 failed
2. 点击重试按钮重新发送消息
3. 重试时重置为 pending 状态

## 验收标准

- [ ] 发送消息后立即显示在列表中
- [ ] pending 状态有视觉指示
- [ ] 消息确认后状态更新为 sent
- [ ] 发送失败显示错误状态
- [ ] 重试功能正常工作
