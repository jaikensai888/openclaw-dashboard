# 专家编辑与提示词传递设计

## 概述

增加编辑专家卡片的功能，允许用户修改专家信息（包括系统提示词），并确保会话时专家的 systemPrompt 正确传递给后端 AI。

## 需求

1. 用户可以在专家卡片上点击编辑按钮，修改专家的所有属性
2. 用户可以在专家中心新增自定义专家
3. 发送消息时，将当前选中的 expertId 传递给后端
4. 后端根据 expertId 查询 systemPrompt 并在 AI 调用中使用

## 技术方案

### 方案选择

采用 **轻量级 Modal + expertId 传递** 方案：
- 编辑按钮在专家卡片上，点击弹出 Modal
- 复用现有 API (`PUT /api/v1/experts/:id`)
- WebSocket `chat.send` 传递 `expertId`，后端查询 `systemPrompt`

### 组件结构

```
apps/web/src/components/expert/
├── ExpertCard.tsx        # 现有 - 添加编辑按钮
├── ExpertCenter.tsx      # 现有 - 添加新增按钮
├── ExpertModal.tsx       # 新增 - 编辑/新增专家的模态框
└── ExpertForm.tsx        # 新增 - 专家表单（可复用）
```

### 数据流

```
[编辑专家]
ExpertModal 保存 → PUT /api/v1/experts/:id → 更新 chatStore.experts

[新增专家]
ExpertModal 保存 → POST /api/v1/experts → 添加到 chatStore.experts

[发送消息]
InputBar 发送 → useWebSocket.sendMessage(conversationId, content, expertId)
              → 后端根据 expertId 查询 systemPrompt
```

## 详细设计

### 1. ExpertModal 组件

**Props:**
```typescript
interface ExpertModalProps {
  mode: 'edit' | 'create';
  expert?: Expert;  // edit 模式必填
  isOpen: boolean;
  onClose: () => void;
  onSave: (expert: Expert) => void;
}
```

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | text | ✅ | 专家名称 |
| title | text | ✅ | 备注头衔 |
| category | select | ✅ | 分类（从现有分类选择或新建） |
| description | textarea | ❌ | 简介 |
| systemPrompt | textarea | ✅ | 系统提示词 |
| color | color picker | ❌ | 主题色（默认 #0ea5e9） |
| icon | select | ❌ | 图标（从预设列表选择） |

**状态管理:**
```typescript
const [formData, setFormData] = useState<Partial<Expert>>({
  name: '',
  title: '',
  category: '',
  description: '',
  systemPrompt: '',
  color: '#0ea5e9',
  icon: 'bot',
});
const [loading, setLoading] = useState(false);
```

### 2. ExpertForm 组件

**Props:**
```typescript
interface ExpertFormProps {
  value: Partial<Expert>;
  onChange: (updates: Partial<Expert>) => void;
  categories: string[];
}
```

**可用图标:**
```typescript
const AVAILABLE_ICONS = [
  { value: 'bot', label: '机器人', component: Bot },
  { value: 'user', label: '用户', component: User },
  { value: 'code', label: '代码', component: Code },
  { value: 'pen-tool', label: '写作', component: PenTool },
  { value: 'bar-chart-2', label: '数据', component: BarChart2 },
  { value: 'search', label: '搜索', component: Search },
  { value: 'briefcase', label: '商务', component: Briefcase },
  { value: 'palette', label: '设计', component: Palette },
];
```

### 3. ExpertCard 改动

```typescript
// 添加编辑按钮（hover 时显示）
<button
  onClick={(e) => { e.stopPropagation(); onEdit(expert); }}
  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
             bg-neutral-700 hover:bg-neutral-600 transition-all"
  aria-label="编辑专家"
>
  <Pencil className="w-4 h-4 text-neutral-300" />
</button>
```

### 4. ExpertCenter 改动

- 顶部标题栏添加「新增专家」按钮
- 管理 ExpertModal 的打开状态
- 处理保存后的 experts 列表更新

### 5. chatStore 扩展

```typescript
// 新增方法
updateExpert: (id: string, updates: Partial<Expert>) => void;
addExpert: (expert: Expert) => void;
```

### 6. useWebSocket 改动

```typescript
// 修改 sendMessage 签名
sendMessage: (conversationId: string, content: string, expertId?: string) => void;

// 发送时携带 expertId
send('chat.send', { conversationId, content, tempId, expertId });
```

### 7. 后端 WebSocket Handler 改动

```typescript
// apps/server/src/websocket/handler.ts
case 'chat.send':
  const { conversationId, content, tempId, expertId } = payload;

  let systemPrompt = null;
  if (expertId) {
    const expert = getExpertById(expertId);
    systemPrompt = expert?.system_prompt;
  }

  await processMessage(conversationId, content, {
    systemPrompt,
    tempId,
    expertId
  });
```

## UI 设计

### ExpertModal 布局

```
┌─────────────────────────────────────────────┐
│  编辑专家                              [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  名称 *          [_____________________]    │
│  备注头衔 *      [_____________________]    │
│  分类 *          [ ▼ 选择分类          ]    │
│  简介            [_____________________]    │
│  系统提示词 *    [_____________________]    │
│                  [_____________________]    │
│                                             │
│  ─────────────── 外观设置 ───────────────   │
│  主题色          [ 🟦 选择颜色         ]    │
│  图标            [ ▼ 选择图标          ]    │
│                                             │
├─────────────────────────────────────────────┤
│                    [取消]    [保存]         │
└─────────────────────────────────────────────┘
```

### ExpertCard 编辑按钮

```
┌─────────────────────────┐
│  [默认]           [✏️]  │  ← hover 时显示
│         🤖              │
│        Claw             │
│     智能助手            │
│    [  立即召唤  ]       │
└─────────────────────────┘
```

### 设计规范

| 元素 | 样式 |
|------|------|
| 模态框背景 | `bg-neutral-800` |
| 边框 | `border-neutral-700` |
| 输入框 | `bg-neutral-900 border-neutral-700` |
| 主按钮 | `bg-primary-600 hover:bg-primary-700` |
| 次按钮 | `bg-neutral-700 hover:bg-neutral-600` |
| 圆角 | `rounded-lg` |
| focus ring | `focus:ring-2 focus:ring-primary-500` |

## 文件变更清单

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/expert/ExpertModal.tsx` | 新增 | 编辑/新增专家模态框 |
| `components/expert/ExpertForm.tsx` | 新增 | 专家表单组件 |
| `components/expert/ExpertCard.tsx` | 修改 | 添加编辑按钮 |
| `components/expert/ExpertCenter.tsx` | 修改 | 添加新增按钮 |
| `stores/chatStore.ts` | 修改 | 添加 updateExpert、addExpert |
| `hooks/useWebSocket.ts` | 修改 | sendMessage 支持 expertId |

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `websocket/handler.ts` | 修改 | chat.send 处理 expertId |

## 实现顺序

1. 后端先行 - 修改 WebSocket handler 支持 expertId
2. Store 扩展 - 添加 expert 更新方法
3. WebSocket 钩子 - 修改 sendMessage 签名
4. UI 组件 - ExpertForm → ExpertModal
5. 集成 - ExpertCard 和 ExpertCenter 调用 Modal

## 验收标准

- [ ] 点击专家卡片编辑按钮可打开编辑 Modal
- [ ] 编辑 Modal 可修改所有字段并保存
- [ ] 保存后专家卡片信息立即更新
- [ ] 专家中心顶部有新增按钮
- [ ] 新增专家后出现在专家列表中
- [ ] 发送消息时 expertId 正确传递给后端
- [ ] 后端使用 expertId 对应的 systemPrompt 调用 AI
