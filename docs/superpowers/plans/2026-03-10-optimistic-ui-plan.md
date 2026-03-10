# 乐观更新 UI 实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现聊天消息乐观更新，发送后立即显示，失败可重试

**Architecture:** 在前端 Store 中管理消息状态（pending/sent/failed），WebSocket 发送时携带 tempId，服务器回传用于匹配确认

**Tech Stack:** React, Zustand, WebSocket, Tailwind CSS

---

## 文件结构

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| `apps/web/src/stores/chatStore.ts` | 修改 | 添加消息状态管理和 optimistic actions |
| `apps/web/src/hooks/useWebSocket.ts` | 修改 | sendMessage 改造，添加 tempId 处理 |
| `apps/web/src/components/chat/MessageItem.tsx` | 修改 | 显示 pending/failed 状态 |
| `apps/web/src/components/chat/InputBar.tsx` | 修改 | 发送逻辑调整 |
| `apps/server/src/routes/websocket.ts` | 修改 | 广播时携带 tempId |
| `packages/shared/types/src/index.ts` | 修改 | Message 接口添加 status/tempId |

---

## Chunk 1: 类型和 Store 更新

### Task 1: 更新共享类型定义

**Files:**
- Modify: `packages/shared/types/src/index.ts`

- [ ] **Step 1: 扩展 Message 接口**

```typescript
// 在 Message 接口中添加以下字段
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  taskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  // 新增字段
  status?: 'pending' | 'sent' | 'failed';
  tempId?: string;  // 临时 ID，用于乐观更新匹配
  error?: string;   // 错误信息
}
```

- [ ] **Step 2: 验证类型编译**

Run: `cd packages/shared/types && pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 3: 提交**

```bash
git add packages/shared/types/src/index.ts
git commit -m "feat(types): 添加 Message status 和 tempId 字段

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 2: 更新 Store 添加乐观更新逻辑

**Files:**
- Modify: `apps/web/src/stores/chatStore.ts`

- [ ] **Step 1: 扩展 Message 接口**

在 `chatStore.ts` 中找到 Message 接口定义，添加 status 和 error 字段：

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  messageType: 'text' | 'task_start' | 'task_update' | 'task_end';
  taskId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  // 新增
  status?: 'pending' | 'sent' | 'failed';
  tempId?: string;
  error?: string;
}
```

- [ ] **Step 2: 添加 ChatState 新 actions**

在 ChatState 接口中添加：

```typescript
interface ChatState {
  // ... 现有字段 ...

  // 乐观更新 actions
  addPendingMessage: (conversationId: string, content: string) => string;
  confirmMessage: (tempId: string, serverMessage: Message) => void;
  failMessage: (tempId: string, error: string) => void;
  retryMessage: (tempId: string, conversationId: string, content: string) => void;
}
```

- [ ] **Step 3: 实现 addPendingMessage action**

在 `useChatStore.create()` 实现部分添加：

```typescript
addPendingMessage: (conversationId, content) => {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const pendingMessage: Message = {
    id: tempId,
    conversationId,
    role: 'user',
    content,
    messageType: 'text',
    createdAt: now,
    status: 'pending',
    tempId,
  };

  set((state) => {
    const existingMessages = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: [...existingMessages, pendingMessage],
      },
    };
  });

  return tempId;
},
```

- [ ] **Step 4: 实现 confirmMessage action**

```typescript
confirmMessage: (tempId, serverMessage) => {
  set((state) => {
    const conversationId = serverMessage.conversationId;
    const messages = state.messages[conversationId] || [];

    return {
      messages: {
        ...state.messages,
        [conversationId]: messages.map((msg) =>
          msg.tempId === tempId
            ? { ...serverMessage, status: 'sent' }
            : msg
        ),
      },
    };
  });
},
```

- [ ] **Step 5: 实现 failMessage action**

```typescript
failMessage: (tempId, error) => {
  set((state) => {
    // 找到对应的消息
    for (const conversationId of Object.keys(state.messages)) {
      const messages = state.messages[conversationId];
      const msgIndex = messages.findIndex((m) => m.tempId === tempId);
      if (msgIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[msgIndex] = {
          ...updatedMessages[msgIndex],
          status: 'failed',
          error,
        };
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        };
      }
    }
    return state;
  });
},
```

- [ ] **Step 6: 实现 retryMessage action**

```typescript
retryMessage: (tempId, conversationId, content) => {
  set((state) => {
    const messages = state.messages[conversationId] || [];
    return {
      messages: {
        ...state.messages,
        [conversationId]: messages.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, status: 'pending', error: undefined }
            : msg
        ),
      },
    };
  });
},
```

- [ ] **Step 7: 验证编译**

Run: `cd apps/web && pnpm build`
Expected: 编译成功

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/stores/chatStore.ts
git commit -m "feat(store): 添加乐观更新 actions

- addPendingMessage: 立即添加本地消息
- confirmMessage: 服务器确认后替换
- failMessage: 标记发送失败
- retryMessage: 重置为 pending 状态

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: WebSocket 和后端更新

### Task 3: 更新 useWebSocket hook

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 导入 Message 类型**

确保导入了完整的 Message 类型（如果没有）：

```typescript
import type { Message, Task, TaskOutput } from '@openclaw-dashboard/shared';
```

- [ ] **Step 2: 修改 sendMessage 函数**

找到 `sendMessage` 的 useCallback，修改为：

```typescript
const sendMessage = useCallback(
  (conversationId: string, content: string) => {
    const store = useChatStore.getState();

    // 1. 先添加本地消息（乐观更新）
    const tempId = store.addPendingMessage(conversationId, content);

    // 2. 发送到服务器，带上 tempId
    send('chat.send', { conversationId, content, tempId });
  },
  []
);
```

- [ ] **Step 3: 添加 confirmMessage 和 failMessage 函数**

```typescript
const confirmMessage = useCallback(
  (tempId: string, serverMessage: Message) => {
    const store = useChatStore.getState();
    store.confirmMessage(tempId, serverMessage);
  },
  []
);

const failMessage = useCallback(
  (tempId: string, error: string) => {
    const store = useChatStore.getState();
    store.failMessage(tempId, error);
  },
  []
);
```

- [ ] **Step 4: 修改 handleMessage 中的 chat.message 处理**

找到 `case 'chat.message':` 块，修改为：

```typescript
case 'chat.message':
  {
    const msg = payload as Message;

    // 如果是确认我们发送的消息（有 tempId）
    if (msg.tempId && msg.role === 'user') {
      const store = useChatStore.getState();
      store.confirmMessage(msg.tempId, msg);
    } else {
      // 其他消息（如 assistant 回复）正常添加
      store.addMessage(msg.conversationId, msg);
    }
  }
  break;
```

- [ ] **Step 5: 添加 WebSocket 断开时标记 pending 为 failed**

在 `ws.onclose` 回调中添加：

```typescript
ws.onclose = (event) => {
  console.log('[WS] Disconnected from server', event.code, event.reason);
  globalState.instance = null;
  globalState.isConnecting = false;

  // 标记所有 pending 消息为 failed
  const store = useChatStore.getState();
  for (const convId of Object.keys(store.messages)) {
    const messages = store.messages[convId];
    for (const msg of messages) {
      if (msg.status === 'pending' && msg.tempId) {
        store.failMessage(msg.tempId, '连接已断开');
      }
    }
  }

  // ... 原有的重连逻辑 ...
};
```

- [ ] **Step 6: 更新返回值**

```typescript
return {
  sendMessage,
  confirmMessage,
  failMessage,
  createConversation: createConversationWS,
  switchConversation,
  cancelTask,
  loadHistory,
  renameConversation,
  togglePinConversation,
  isConnected: globalState.instance?.readyState === WebSocket.OPEN,
};
```

- [ ] **Step 7: 验证编译**

Run: `cd apps/web && pnpm build`
Expected: 编译成功

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/hooks/useWebSocket.ts
git commit -m "feat(ws): 实现乐观更新发送逻辑

- sendMessage 先添加本地消息再发送
- 处理服务器确认消息
- 断开连接时标记 pending 为 failed

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 4: 更新后端 WebSocket

**Files:**
- Modify: `apps/server/src/routes/websocket.ts`

- [ ] **Step 1: 修改 handleChatSend 接收 tempId**

找到 `handleChatSend` 函数，修改参数类型和广播逻辑：

```typescript
async function handleChatSend(ws: WebSocket, payload: { conversationId: string; content: string; tempId?: string }) {
  const { conversationId, content, tempId } = payload;

  // ... 原有逻辑 ...

  // 广播消息时携带 tempId
  broadcast('chat.message', {
    id: messageId,
    conversationId,
    role: 'user',
    content,
    messageType: 'text',
    tempId,  // 回传给前端用于匹配
    createdAt: now,
  });

  // ... 其余逻辑不变 ...
}
```

- [ ] **Step 2: 验证编译**

Run: `cd apps/server && pnpm build`
Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add apps/server/src/routes/websocket.ts
git commit -m "feat(server): 广播消息时携带 tempId

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: UI 更新

### Task 5: 更新 MessageItem 显示状态

**Files:**
- Modify: `apps/web/src/components/chat/MessageItem.tsx`

- [ ] **Step 1: 添加 Loader2 和 RotateCcw 图标导入**

```typescript
import { User, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
```

- [ ] **Step 2: 扩展 MessageItemProps 接口**

```typescript
interface MessageItemProps {
  message: Message;
  onRetry?: (tempId: string) => void;
}
```

- [ ] **Step 6: 更新组件显示状态指示器**

完整替换 MessageItem 组件：

```typescript
export function MessageItem({ message, onRetry }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-neutral-600' : 'bg-primary-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <span className="text-sm font-medium">AI</span>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 relative ${
          isUser
            ? 'bg-primary-600 rounded-l-xl rounded-tr-xl'
            : 'bg-neutral-800 rounded-r-xl rounded-tl-xl'
        } p-4 ${isFailed ? 'border-l-4 border-red-500' : ''}`}
      >
        <div className="markdown-content">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Pending 指示器 */}
        {isPending && (
          <div className="absolute top-2 right-2">
            <Loader2 className="w-4 h-4 animate-spin text-white/50" />
          </div>
        )}

        {/* Failed 状态 */}
        {isFailed && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span>{message.error || '发送失败'}</span>
            {message.tempId && onRetry && (
              <button
                onClick={() => onRetry(message.tempId!)}
                className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重试
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 验证编译**

Run: `cd apps/web && pnpm build`
Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/chat/MessageItem.tsx
git commit -m "feat(ui): 显示消息发送状态

- pending: 右上角加载动画
- failed: 红色边框 + 错误提示 + 重试按钮

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 6: 更新 MessageList 传递重试函数

**Files:**
- Modify: `apps/web/src/components/chat/MessageList.tsx`

- [ ] **Step 1: 添加 props 接口**

```typescript
interface MessageListProps {
  messages: Message[];
  onRetry?: (tempId: string, conversationId: string, content: string) => void;
}
```

- [ ] **Step 2: 更新组件实现**

```typescript
export function MessageList({ messages, onRetry }: MessageListProps) {
  const handleRetry = (tempId: string) => {
    const msg = messages.find(m => m.tempId === tempId);
    if (msg && onRetry) {
      onRetry(tempId, msg.conversationId, msg.content);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {messages.map((message) => {
        // Show task card for task messages
        if (message.messageType === 'task_start' && message.taskId) {
          return (
            <TaskCard
              key={message.id}
              taskId={message.taskId}
              message={message}
            />
          );
        }

        // Regular message
        return (
          <MessageItem
            key={message.id}
            message={message}
            onRetry={handleRetry}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 验证编译**

Run: `cd apps/web && pnpm build`
Expected: 编译成功

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/chat/MessageList.tsx
git commit -m "feat(ui): MessageList 传递重试函数

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 7: 更新 ChatPanel 处理重试

**Files:**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 导入 useWebSocket 获取重试函数**

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';
```

- [ ] **Step 2: 在组件中获取 retryMessage**

```typescript
const { retryMessage } = useWebSocket();
```

- [ ] **Step 3: 实现 handleRetry 函数**

```typescript
const handleRetry = (tempId: string, conversationId: string, content: string) => {
  // 1. 更新本地状态为 pending
  const store = useChatStore.getState();
  store.retryMessage(tempId, conversationId, content);

  // 2. 重新发送到服务器
  sendMessage(conversationId, content);
};
```

注意：这里需要从 useWebSocket 获取 sendMessage，而不是重新调用。

- [ ] **Step 4: 修改 useWebSocket 导入以获取 sendMessage**

```typescript
const { sendMessage } = useWebSocket();
```

- [ ] **Step 5: 传递 handleRetry 给 MessageList**

```typescript
<MessageList messages={conversationMessages} onRetry={handleRetry} />
```

- [ ] **Step 6: 完整更新后的 ChatPanel**

```typescript
'use client';

import { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';

export function ChatPanel() {
  const { currentConversationId, messages, isStreaming, streamingContent } = useChatStore();
  const { sendMessage } = useWebSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationMessages = currentConversationId
    ? messages[currentConversationId] || []
    : [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length, streamingContent]);

  const handleRetry = (tempId: string, conversationId: string, content: string) => {
    const store = useChatStore.getState();
    store.retryMessage(tempId, conversationId, content);
    sendMessage(conversationId, content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {conversationMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <p className="text-lg mb-2">开始新的对话</p>
              <p className="text-sm">输入消息与 AI 交流</p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={conversationMessages} onRetry={handleRetry} />
            {isStreaming && (
              <div className="flex gap-3 py-4">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
                  AI
                </div>
                <div className="flex-1 bg-neutral-800 rounded-lg p-4 markdown-content">
                  <p className="whitespace-pre-wrap streaming-cursor">{streamingContent}</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-700 p-4">
        <InputBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 验证编译**

Run: `cd apps/web && pnpm build`
Expected: 编译成功

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/components/chat/ChatPanel.tsx
git commit -m "feat(ui): ChatPanel 处理消息重试逻辑

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: 验收测试

### Task 8: 验收测试

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`
Expected: 前端和后端都启动成功

- [ ] **Step 2: 测试乐观更新**
1. 打开浏览器 http://localhost:3000
2. 发送一条消息
3. 验证：消息立即显示，右上角有加载动画
4. 等待服务器确认后，加载动画消失

- [ ] **Step 3: 测试失败状态**
1. 停止后端服务器
2. 发送一条消息
3. 验证：消息显示为红色边框 + 错误提示 + 重试按钮

- [ ] **Step 4: 测试重试功能**
1. 启动后端服务器
2. 点击失败消息的重试按钮
3. 验证：消息状态变为 pending，然后发送成功

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: 完成乐观更新 UI 实现

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 发送消息后立即显示在列表中
- [ ] pending 状态有视觉指示（右上角加载动画）
- [ ] 消息确认后状态更新为 sent
- [ ] 发送失败显示错误状态（红色边框 + 错误提示）
- [ ] 重试功能正常工作
- [ ] WebSocket 断开时 pending 消息标记为 failed
