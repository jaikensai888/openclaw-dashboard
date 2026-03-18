# 专家编辑与提示词传递实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现专家卡片的编辑功能，并确保会话时专家的 systemPrompt 正确传递给后端 AI。

**Architecture:** 前端新增 ExpertModal/ExpertForm 组件，修改 useWebSocket 传递 expertId；后端 websocket.ts 查询 experts 表获取 systemPrompt 并传递给 orchestrator。

**Tech Stack:** React, TypeScript, Tailwind CSS, Fastify, SQLite, WebSocket

---

## Chunk 1: 后端 - WebSocket 支持 expertId

### Task 1: 修改 WebSocket 消息类型

**Files:**
- Modify: `apps/server/src/routes/websocket.ts:174-268`

- [ ] **Step 1: 修改 handleChatSend 函数签名，接受 expertId 参数**

```typescript
// apps/server/src/routes/websocket.ts:174
async function handleChatSend(ws: WebSocket, payload: {
  conversationId: string;
  content: string;
  tempId?: string;
  virtualAgentId?: VirtualAgentId;
  expertId?: string;  // 新增
}) {
```

- [ ] **Step 2: 在 handleChatSend 中查询 expert 的 systemPrompt**

在 `handleChatSend` 函数中，在调用 orchestrator 之前添加：

```typescript
// 在 line 213 之前添加
let expertSystemPrompt: string | undefined;
if (expertId) {
  const expert = get<{ system_prompt: string }>(
    'SELECT system_prompt FROM experts WHERE id = ?',
    [expertId]
  );
  if (expert) {
    expertSystemPrompt = expert.system_prompt;
    console.log(`[WS] Using expert systemPrompt for ${expertId}`);
  }
}
```

- [ ] **Step 3: 传递 expertSystemPrompt 给 orchestrator**

修改 orchestrator 调用：

```typescript
// 修改 line 220-224
const result = await orchestrator.handleUserMessage({
  conversationId,
  content,
  virtualAgentId,
  expertSystemPrompt,  // 新增
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/websocket.ts
git commit -m "feat(ws): 支持 chat.send 携带 expertId 并查询 systemPrompt"
```

### Task 2: 修改 Orchestrator 支持 expertSystemPrompt

**Files:**
- Modify: `apps/server/src/services/orchestrator.ts:34-39, 103-142`

- [ ] **Step 1: 修改 HandleUserMessageOptions 接口**

```typescript
// apps/server/src/services/orchestrator.ts:34-39
export interface HandleUserMessageOptions {
  conversationId: string;
  content: string;
  virtualAgentId?: VirtualAgentId;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expertSystemPrompt?: string;  // 新增
}
```

- [ ] **Step 2: 修改 handleUserMessage 使用 expertSystemPrompt**

在 `handleUserMessage` 方法中，修改 agent 的 systemPrompt 逻辑：

```typescript
// 在 line 125 之后，修改 agent 获取逻辑
const agent = getVirtualAgent(state.currentAgentId) || getDefaultVirtualAgent();

// 如果有 expertSystemPrompt，覆盖 agent 的 systemPrompt
const effectiveSystemPrompt = options.expertSystemPrompt || agent.systemPrompt;
```

- [ ] **Step 3: 传递 effectiveSystemPrompt 给 runViaGateway**

修改 `runViaGateway` 调用：

```typescript
// 修改 line 137
return this.runViaGateway(conversationId, agent, content, history, state, effectiveSystemPrompt);
```

- [ ] **Step 4: 修改 runViaGateway 方法签名**

```typescript
// 修改 line 239-245
private async runViaGateway(
  conversationId: string,
  agent: VirtualAgent,
  content: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
  state: ConversationState,
  systemPrompt?: string  // 新增参数
): Promise<{ runId?: string; error?: string }> {
```

- [ ] **Step 5: 使用传入的 systemPrompt**

```typescript
// 修改 line 252-259
const options: RunAgentOptions = {
  conversationId,
  virtualAgentId: agent.id,
  systemPrompt: systemPrompt || agent.systemPrompt,  // 使用传入的或默认的
  userMessage: content,
  history,
  model: agent.model,
};
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/orchestrator.ts
git commit -m "feat(orchestrator): 支持 expertSystemPrompt 覆盖默认提示词"
```

---

## Chunk 2: 前端 - Store 扩展

### Task 3: 扩展 chatStore 支持 expert 操作

**Files:**
- Modify: `apps/web/src/stores/chatStore.ts:184-188, 542-546`

- [ ] **Step 1: 添加 updateExpert 方法**

在 `ChatState` 接口（约 line 184-188）添加：

```typescript
// 在 setExperts 之后添加
updateExpert: (id: string, updates: Partial<Expert>) => void;
addExpert: (expert: Expert) => void;
```

- [ ] **Step 2: 实现 updateExpert 和 addExpert 方法**

在 store 实现部分（约 line 542-546）添加：

```typescript
// 在 setCurrentExpertId 之后添加

updateExpert: (id, updates) => set((state) => ({
  experts: state.experts.map((e) =>
    e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
  ),
})),

addExpert: (expert) => set((state) => ({
  experts: [expert, ...state.experts],
})),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/stores/chatStore.ts
git commit -m "feat(store): 添加 updateExpert 和 addExpert 方法"
```

### Task 4: 修改 useWebSocket sendMessage 支持 expertId

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts:465-481`

- [ ] **Step 1: 修改 sendMessage 函数签名**

```typescript
// 修改 line 465-481
const sendMessage = useCallback(
  (conversationId: string, content: string, expertId?: string) => {
    const currentStore = useChatStore.getState();

    // 1. 先添加本地消息（乐观更新）
    const tempId = currentStore.addPendingMessage(conversationId, content);

    // 2. 开始计时等待 AI 响应
    currentStore.startThinking();

    // 3. 发送到服务器，带上 tempId 和 expertId
    send('chat.send', { conversationId, content, tempId, expertId });

    return tempId;
  },
  []
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useWebSocket.ts
git commit -m "feat(ws): sendMessage 支持 expertId 参数"
```

---

## Chunk 3: 前端 - UI 组件

### Task 5: 创建 ExpertForm 组件

**Files:**
- Create: `apps/web/src/components/expert/ExpertForm.tsx`

- [ ] **Step 1: 创建 ExpertForm 组件文件**

```tsx
'use client';

import { Bot, User, Code, PenTool, BarChart2, Search, Briefcase, Palette, LucideIcon } from 'lucide-react';
import type { Expert } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

interface ExpertFormProps {
  value: Partial<Expert>;
  onChange: (updates: Partial<Expert>) => void;
  categories: string[];
}

// 可用图标列表
const AVAILABLE_ICONS: { value: string; label: string; component: LucideIcon }[] = [
  { value: 'bot', label: '机器人', component: Bot },
  { value: 'user', label: '用户', component: User },
  { value: 'code', label: '代码', component: Code },
  { value: 'pen-tool', label: '写作', component: PenTool },
  { value: 'bar-chart-2', label: '数据', component: BarChart2 },
  { value: 'search', label: '搜索', component: Search },
  { value: 'briefcase', label: '商务', component: Briefcase },
  { value: 'palette', label: '设计', component: Palette },
];

// 预设颜色
const PRESET_COLORS = [
  '#0ea5e9', // sky-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

export function ExpertForm({ value, onChange, categories }: ExpertFormProps) {
  const handleChange = (field: keyof Expert, fieldValue: string) => {
    onChange({ [field]: fieldValue });
  };

  return (
    <div className="space-y-4">
      {/* 名称 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="专家名称"
        />
      </div>

      {/* 备注头衔 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          备注头衔 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="如：内容创作专家"
        />
      </div>

      {/* 分类 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          分类 <span className="text-red-400">*</span>
        </label>
        <select
          value={value.category || ''}
          onChange={(e) => handleChange('category', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">选择分类</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 简介 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          简介
        </label>
        <input
          type="text"
          value={value.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="简短描述专家的专长"
        />
      </div>

      {/* 系统提示词 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          系统提示词 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={value.systemPrompt || ''}
          onChange={(e) => handleChange('systemPrompt', e.target.value)}
          rows={4}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     resize-none font-mono"
          placeholder="你是xxx，一位专业的..."
        />
      </div>

      {/* 外观设置分隔线 */}
      <div className="border-t border-neutral-700 pt-4 mt-4">
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          外观设置
        </h4>

        {/* 主题色 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            主题色
          </label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange('color', color)}
                className={cn(
                  'w-8 h-8 rounded-lg border-2 transition-all',
                  value.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                aria-label={`选择颜色 ${color}`}
              />
            ))}
          </div>
        </div>

        {/* 图标 */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            图标
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVAILABLE_ICONS.map((icon) => {
              const IconComponent = icon.component;
              return (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => handleChange('icon', icon.value)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                    value.icon === icon.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  )}
                  aria-label={icon.label}
                  title={icon.label}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/expert/ExpertForm.tsx
git commit -m "feat(expert): 添加 ExpertForm 表单组件"
```

### Task 6: 创建 ExpertModal 组件

**Files:**
- Create: `apps/web/src/components/expert/ExpertModal.tsx`

- [ ] **Step 1: 创建 ExpertModal 组件文件**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Expert } from '@/stores/chatStore';
import { ExpertForm } from './ExpertForm';
import { API_BASE_URL } from '@/lib/api';

interface ExpertModalProps {
  mode: 'edit' | 'create';
  expert?: Expert;
  isOpen: boolean;
  onClose: () => void;
  onSave: (expert: Expert) => void;
  categories: string[];
}

export function ExpertModal({ mode, expert, isOpen, onClose, onSave, categories }: ExpertModalProps) {
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化表单数据
  useEffect(() => {
    if (mode === 'edit' && expert) {
      setFormData({
        name: expert.name,
        title: expert.title,
        category: expert.category,
        description: expert.description || '',
        systemPrompt: expert.systemPrompt,
        color: expert.color || '#0ea5e9',
        icon: expert.icon || 'bot',
      });
    } else if (mode === 'create') {
      setFormData({
        name: '',
        title: '',
        category: categories[0] || '',
        description: '',
        systemPrompt: '',
        color: '#0ea5e9',
        icon: 'bot',
      });
    }
    setErrors({});
  }, [mode, expert, isOpen, categories]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = '请输入名称';
    }
    if (!formData.title?.trim()) {
      newErrors.title = '请输入备注头衔';
    }
    if (!formData.category) {
      newErrors.category = '请选择分类';
    }
    if (!formData.systemPrompt?.trim()) {
      newErrors.systemPrompt = '请输入系统提示词';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const url = mode === 'edit'
        ? `${API_BASE_URL}/experts/${expert?.id}`
        : `${API_BASE_URL}/experts`;
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        onSave(data.data);
        onClose();
      } else {
        setErrors({ submit: data.error || '保存失败' });
      }
    } catch (error) {
      setErrors({ submit: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expert-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-700">
            <h2 id="expert-modal-title" className="text-lg font-semibold">
              {mode === 'edit' ? '编辑专家' : '新增专家'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <ExpertForm
              value={formData}
              onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
              categories={categories}
            />

            {/* Error message */}
            {errors.submit && (
              <p className="mt-4 text-sm text-red-400">{errors.submit}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50
                         rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/expert/ExpertModal.tsx
git commit -m "feat(expert): 添加 ExpertModal 模态框组件"
```

### Task 7: 修改 ExpertCard 添加编辑按钮

**Files:**
- Modify: `apps/web/src/components/expert/ExpertCard.tsx`

- [ ] **Step 1: 修改 ExpertCardProps 接口**

```typescript
// 在 line 7-11 添加 onEdit 属性
interface ExpertCardProps {
  expert: Expert;
  isSelected?: boolean;
  onSummon: (expert: Expert) => void;
  onEdit?: (expert: Expert) => void;  // 新增
}
```

- [ ] **Step 2: 添加编辑按钮**

在组件内部，添加编辑按钮：

```tsx
// 修改函数签名
export function ExpertCard({ expert, isSelected, onSummon, onEdit }: ExpertCardProps) {

// 在卡片 div 内部，默认标签之后添加编辑按钮
{/* Edit button - appears on hover */}
{onEdit && (
  <button
    onClick={(e) => { e.stopPropagation(); onEdit(expert); }}
    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
               bg-neutral-700 hover:bg-neutral-600 transition-all z-10"
    aria-label={`编辑 ${expert.name}`}
  >
    <Pencil className="w-4 h-4 text-neutral-300" />
  </button>
)}
```

- [ ] **Step 3: 导入 Pencil 图标**

```typescript
// 修改 line 3
import { User, Bot, Pencil } from 'lucide-react';
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/expert/ExpertCard.tsx
git commit -m "feat(expert): ExpertCard 添加编辑按钮"
```

### Task 8: 修改 ExpertCenter 集成 Modal

**Files:**
- Modify: `apps/web/src/components/expert/ExpertCenter.tsx`

- [ ] **Step 1: 添加状态和导入**

```tsx
// 添加导入
import { Plus } from 'lucide-react';
import { ExpertModal } from './ExpertModal';

// 在组件内部添加状态
const [modalOpen, setModalOpen] = useState(false);
const [modalMode, setModalMode] = useState<'edit' | 'create'>('create');
const [editingExpert, setEditingExpert] = useState<Expert | undefined>();
const { experts, setExperts, updateExpert, addExpert, setCurrentView, setCurrentExpertId, createConversation } = useChatStore();
```

- [ ] **Step 2: 添加打开 modal 的处理函数**

```tsx
const handleOpenCreate = () => {
  setModalMode('create');
  setEditingExpert(undefined);
  setModalOpen(true);
};

const handleOpenEdit = (expert: Expert) => {
  setModalMode('edit');
  setEditingExpert(expert);
  setModalOpen(true);
};

const handleSaveExpert = (savedExpert: Expert) => {
  if (modalMode === 'create') {
    addExpert(savedExpert);
  } else {
    updateExpert(savedExpert.id, savedExpert);
  }
};
```

- [ ] **Step 3: 修改 Header 添加新增按钮**

```tsx
// 修改 Header 部分（约 line 70-76）
<div className="p-6 border-b border-neutral-700">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-semibold mb-2">专家中心</h1>
      <p className="text-sm text-neutral-500">
        按行业分类浏览专家，召唤他们为你服务
      </p>
    </div>
    <button
      onClick={handleOpenCreate}
      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700
                 rounded-lg transition-colors text-sm"
    >
      <Plus className="w-4 h-4" />
      <span>新增专家</span>
    </button>
  </div>
</div>
```

- [ ] **Step 4: 传递 onEdit 给 ExpertCard**

```tsx
// 修改 ExpertCard 渲染（约 line 115-121）
<ExpertCard
  key={expert.id}
  expert={expert}
  onSummon={handleSummon}
  onEdit={handleOpenEdit}
/>
```

- [ ] **Step 5: 添加 ExpertModal 组件**

在 return 的最末尾添加：

```tsx
      {/* Expert Modal */}
      <ExpertModal
        mode={modalMode}
        expert={editingExpert}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveExpert}
        categories={categories.map(c => c.category)}
      />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/expert/ExpertCenter.tsx
git commit -m "feat(expert): ExpertCenter 集成新增和编辑功能"
```

### Task 9: 修改 InputBar 传递 expertId

**Files:**
- Modify: `apps/web/src/components/chat/InputBar.tsx`

- [ ] **Step 1: 获取当前 expertId**

```tsx
// 在 useChatStore 解构中添加
const { currentConversationId, isStreaming, currentExpertId } = useChatStore();
```

- [ ] **Step 2: 修改 sendMessage 调用**

```tsx
// 修改 handleSubmit 函数中的 sendMessage 调用（约 line 25）
sendMessage(currentConversationId, content, currentExpertId || undefined);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/InputBar.tsx
git commit -m "feat(chat): InputBar 发送消息时传递 expertId"
```

---

## Chunk 4: 验收测试

### Task 10: 手动测试验收

- [ ] **Step 1: 启动开发服务器**

```bash
# 在项目根目录
pnpm dev
```

- [ ] **Step 2: 测试新增专家功能**

1. 打开 http://localhost:3000
2. 点击左侧导航「专家」
3. 点击右上角「新增专家」按钮
4. 填写表单并保存
5. 验证新专家出现在列表中

- [ ] **Step 3: 测试编辑专家功能**

1. 鼠标悬停在专家卡片上
2. 点击编辑按钮（铅笔图标）
3. 修改名称或提示词
4. 保存并验证卡片信息已更新

- [ ] **Step 4: 测试会话时专家提示词传递**

1. 选择一个专家并开始对话
2. 在后端控制台查看日志，确认 `[WS] Using expert systemPrompt for xxx` 出现
3. 验证 AI 回复符合专家的 systemPrompt 设定

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat(expert): 完成专家编辑与提示词传递功能"
```

---

## 文件变更总结

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/server/src/routes/websocket.ts` | 修改 | 支持 expertId 查询 systemPrompt |
| `apps/server/src/services/orchestrator.ts` | 修改 | 支持 expertSystemPrompt 参数 |
| `apps/web/src/stores/chatStore.ts` | 修改 | 添加 updateExpert、addExpert |
| `apps/web/src/hooks/useWebSocket.ts` | 修改 | sendMessage 支持 expertId |
| `apps/web/src/components/expert/ExpertForm.tsx` | 新增 | 专家表单组件 |
| `apps/web/src/components/expert/ExpertModal.tsx` | 新增 | 编辑/新增模态框 |
| `apps/web/src/components/expert/ExpertCard.tsx` | 修改 | 添加编辑按钮 |
| `apps/web/src/components/expert/ExpertCenter.tsx` | 修改 | 集成 Modal |
| `apps/web/src/components/chat/InputBar.tsx` | 修改 | 传递 expertId |
