# 定时任务新增功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为自动化模块添加新增定时任务功能，用户输入自然语言，后端 AI 解析为 Cron 表达式。

**Architecture:** 后端修改创建 API 支持 `input` 字段并调用规则解析，前端创建 AutomationModal 模态框。

**Tech Stack:** Fastify (后端), Next.js + React (前端)

---

## 文件结构

### 后端
- `apps/server/src/routes/automations.ts` - 修改：创建 API 支持 `input` 字段

### 前端
- `apps/web/src/components/automation/AutomationModal.tsx` - 新增：新增任务模态框
- `apps/web/src/components/automation/AutomationCenter.tsx` - 修改：集成 Modal

---

## Chunk 1: 后端 - 修改创建 API

### Task 1: 修改 automations.ts 支持 input 字段

**Files:**
- Modify: `apps/server/src/routes/automations.ts:174-233`

- [ ] **Step 1: 添加 parseScheduleWithRules 函数**

在文件末尾添加解析函数：

```typescript
/**
 * Simple rule-based parser for common time patterns
 */
function parseScheduleFromInput(input: string): { title: string; schedule: string; scheduleDescription: string } | null {
  const lowerInput = input.toLowerCase();

  // Time patterns with regex
  const patterns = [
    { regex: /每(\d+)分钟/, schedule: (m: string) => `*/${m} * * * *`, desc: (m: string) => `每 ${m} 分钟` },
    { regex: /每(\d+)小时/, schedule: (h: string) => `0 */${h} * * *`, desc: (h: string) => `每 ${h} 小时` },
    { regex: /每天\s*(\d+):(\d+)/, schedule: (h: string, m: string) => `${m} ${h} * * *`, desc: (h: string, m: string) => `每天 ${h}:${m.padStart(2, '0')}` },
    { regex: /每天\s*(\d+)点/, schedule: (h: string) => `0 ${h} * * *`, desc: (h: string) => `每天 ${h}:00` },
    { regex: /每小时/, schedule: () => `0 * * * *`, desc: () => `每小时整点` },
    { regex: /每分钟/, schedule: () => `* * * * *`, desc: () => `每分钟` },
  ];

  for (const { regex, schedule, desc } of patterns) {
    const match = lowerInput.match(regex);
    if (match) {
      // Extract title (remove time part)
      let title = input.replace(regex, '').replace(/[，,。、]/g, '').trim();
      if (!title) title = '定时任务';

      let scheduleStr: string;
      let descStr: string;

      if (match.length === 1) {
        scheduleStr = schedule('');
        descStr = desc('');
      } else if (match.length === 2) {
        scheduleStr = schedule(match[1]);
        descStr = desc(match[1]);
      } else if (match.length === 3) {
        scheduleStr = schedule(match[1], match[2]);
        descStr = desc(match[1], match[2]);
      } else {
        continue;
      }

      return { title, schedule: scheduleStr, scheduleDescription: descStr };
    }
  }

  return null;
}
```

- [ ] **Step 2: 修改 POST /automations 请求 Body 类型**

修改 Body 接口，添加 `input` 字段：

```typescript
  // Create automation
  fastify.post<{
    Body: {
      title?: string;           // 可选：如果提供 input 则从 input 解析
      description?: string;
      agentId: string;
      schedule?: string;        // 可选：如果提供 input 则从 input 解析
      scheduleDescription?: string;
      input?: string;           // 新增：自然语言输入
      status?: 'active' | 'paused';
    };
  }>('/automations', async (request, reply) => {
```

- [ ] **Step 3: 修改创建逻辑支持 input 解析**

```typescript
  }>('/automations', async (request, reply) => {
    let { title, description, agentId, schedule, scheduleDescription, input, status } = request.body;

    // If input is provided, parse it to extract schedule info
    if (input && (!title || !schedule)) {
      const parsed = parseScheduleFromInput(input);
      if (parsed) {
        if (!title) title = parsed.title;
        if (!schedule) schedule = parsed.schedule;
        if (!scheduleDescription) scheduleDescription = parsed.scheduleDescription;
      } else {
        // Fallback: use input as title with default schedule
        if (!title) title = input;
        if (!schedule) {
          schedule = '0 9 * * *';
          scheduleDescription = '每天 9:00（默认）';
        }
      }
    }

    // Validate required fields
    if (!title || !agentId || !schedule) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: title, agentId, and schedule (or input)',
      });
    }

    // Validate cron expression
    if (!validateCronExpression(schedule)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid cron expression. Expected 5-part cron format (minute hour day-of-month month day-of-week)',
      });
    }

    const id = `automation_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    // ... rest of the existing code
```

- [ ] **Step 4: 提交后端改动**

```bash
git add apps/server/src/routes/automations.ts
git commit -m "feat(api): automations API 支持 input 字段解析自然语言"
```

---

## Chunk 2: 前端 - AutomationModal 组件

### Task 2: 创建 AutomationModal 组件

**Files:**
- Create: `apps/web/src/components/automation/AutomationModal.tsx`

- [ ] **Step 1: 创建 AutomationModal.tsx**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Automation } from '@/stores/chatStore';
import { API_BASE_URL } from '@/lib/api';

interface Expert {
  id: string;
  name: string;
  title: string;
}

interface AutomationModalProps {
  open: boolean;
  experts: Expert[];
  onClose: () => void;
  onSuccess: (automation: Automation) => void;
}

export function AutomationModal({ open, experts, onClose, onSuccess }: AutomationModalProps) {
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setInput('');
      setAgentId(experts[0]?.id || '');
      setError(null);
    }
  }, [open, experts]);

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('请输入任务描述');
      return;
    }
    if (!agentId) {
      setError('请选择执行专家');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          agentId,
          status: 'active',
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess(data.data);
        onClose();
      } else {
        setError(data.error || '创建失败');
      }
    } catch (err) {
      console.error('Failed to create automation:', err);
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="automation-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 id="automation-modal-title" className="text-lg font-semibold">
            新增定时任务
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              任务描述 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         resize-none"
              placeholder="例如: 每天9点，查询天气并且告诉我"
            />
          </div>

          {/* Expert Select */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              执行专家 <span className="text-red-400">*</span>
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">选择专家</option>
              {experts.map((expert) => (
                <option key={expert.id} value={expert.id}>
                  {expert.name} - {expert.title}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交 AutomationModal**

```bash
git add apps/web/src/components/automation/AutomationModal.tsx
git commit -m "feat(ui): 添加 AutomationModal 新增任务模态框"
```

---

## Chunk 3: 前端 - 集成到 AutomationCenter

### Task 3: 修改 AutomationCenter 集成 Modal

**Files:**
- Modify: `apps/web/src/components/automation/AutomationCenter.tsx`

- [ ] **Step 1: 添加导入和状态**

在文件顶部添加：

```typescript
import { useState, useEffect } from 'react';
import { Plus, Clock, Loader2 } from 'lucide-react';
import { useChatStore, type Automation } from '@/stores/chatStore';
import { AutomationItem } from './AutomationItem';
import { AutomationModal } from './AutomationModal';
import { API_BASE_URL } from '@/lib/api';
```

在组件内添加状态：

```typescript
export function AutomationCenter() {
  const { automations, setAutomations } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<Array<{ id: string; name: string; title: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
```

- [ ] **Step 2: 添加获取专家列表的 useEffect**

```typescript
  // Fetch experts for modal dropdown
  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/experts`);
        const data = await res.json();
        if (data.success) {
          setExperts(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch experts:', error);
      }
    };

    fetchExperts();
  }, []);
```

- [ ] **Step 3: 添加 handleCreate 回调**

```typescript
  const handleCreate = (automation: Automation) => {
    setAutomations([automation, ...automations]);
  };
```

- [ ] **Step 4: 修改「添加」按钮添加点击事件**

```typescript
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>添加</span>
            </button>
```

- [ ] **Step 5: 在组件末尾添加 AutomationModal**

在 `</main>` 之前添加：

```typescript
      {/* Create Modal */}
      <AutomationModal
        open={modalOpen}
        experts={experts}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreate}
      />
    </main>
```

- [ ] **Step 6: 删除「从模版添加」按钮**

删除以下代码：

```typescript
            <button className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors text-neutral-300">
              <span>从模版添加</span>
            </button>
```

- [ ] **Step 7: 提交 AutomationCenter 改动**

```bash
git add apps/web/src/components/automation/AutomationCenter.tsx
git commit -m "feat(automation): 集成 AutomationModal 新增任务功能"
```

---

## 验收清单

- [ ] 点击「添加」打开模态框
- [ ] 模态框有任务描述和专家选择两个输入
- [ ] 输入"每天9点，查询天气"并创建成功
- [ ] 列表显示新创建的任务
- [ ] 任务显示正确的执行时间描述（每天 9:00）

---

## 最终提交

```bash
git add -A
git commit -m "feat: 完成定时任务新增功能

- 后端支持 input 字段解析自然语言
- 前端添加 AutomationModal 模态框
- 集成到 AutomationCenter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
