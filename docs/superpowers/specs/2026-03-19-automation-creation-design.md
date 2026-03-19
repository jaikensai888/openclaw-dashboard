# 定时任务新增功能设计

## 概述

为现有的自动化模块添加新增定时任务功能，使用自然语言输入，后端 AI 解析为 Cron 表达式。

## 需求

1. 用户点击「添加」按钮打开新增模态框
2. 用户用自然语言描述任务（如"每天9点，查询天气"）
3. 用户选择执行专家
4. 点击创建后，后端 AI 解析自然语言生成 Cron 表达式
5. 保存定时任务并刷新列表

## 技术方案

### 交互流程

```
用户输入: "每天9点，查询天气并且告诉我"
选择专家: "Claw"
点击「创建」
    ↓
POST /automations { title, agentId, input: "每天9点..." }
    ↓
后端 AI 解析 → 生成 schedule + scheduleDescription
    ↓
保存到数据库 → 返回结果
```

### 新增 API

**POST `/automations`**（已有，修改逻辑）

```typescript
// 请求
{
  "title": "查询天气并且告诉我",      // 从自然语言提取
  "agentId": "expert_claw_default",
  "input": "每天9点，查询天气并且告诉我",  // 原始输入
  "status": "active"
}

// 响应
{
  "success": true,
  "data": {
    "id": "automation_xxx",
    "title": "查询天气并且告诉我",
    "agentId": "expert_claw_default",
    "schedule": "0 9 * * *",
    "scheduleDescription": "每天 9:00",
    "status": "active",
    ...
  }
}
```

### 前端组件

#### AutomationModal

**Props:**
```typescript
interface AutomationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (automation: Automation) => void;
}
```

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| input | textarea | ✅ | 自然语言描述 |
| agentId | select | ✅ | 从专家列表选择 |

**布局:**
```
┌─────────────────────────────────────────────┐
│  新增定时任务                           [×]  │
├─────────────────────────────────────────────┤
│  任务描述 *                                 │
│  [___________________________________]      │
│  例如: 每天9点，查询天气并且告诉我          │
│                                             │
│  执行专家 *                                 │
│  [ ▼ 选择专家                         ]     │
├─────────────────────────────────────────────┤
│                      [取消]      [创建]     │
└─────────────────────────────────────────────┘
```

### 后端 AI 解析

在创建定时任务时，使用 AI 从自然语言中提取：

1. **title** - 任务名称（去掉时间描述）
2. **schedule** - Cron 表达式
3. **scheduleDescription** - 人类可读的时间描述

**Prompt 示例:**
```
解析以下自然语言，提取任务信息。返回 JSON 格式：
{
  "title": "任务名称（不含时间）",
  "schedule": "cron表达式（5字段）",
  "scheduleDescription": "人类可读的时间描述"
}

输入: "每天9点，查询天气并且告诉我"
```

## 文件变更清单

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `routes/automations.ts` | 修改 | 创建时添加 AI 解析逻辑 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/automation/AutomationCenter.tsx` | 修改 | 添加 Modal 状态和打开逻辑 |
| `components/automation/AutomationModal.tsx` | 新增 | 新增任务模态框 |

## UI 设计规范

| 元素 | 样式 |
|------|------|
| 模态框背景 | `bg-neutral-800` |
| 边框 | `border-neutral-700` |
| 输入框 | `bg-neutral-900 border-neutral-700` |
| 主按钮 | `bg-primary-600 hover:bg-primary-700` |
| 次按钮 | `bg-neutral-700 hover:bg-neutral-600` |

## 实现顺序

1. **后端** - 修改创建 API，添加 AI 解析
2. **前端** - AutomationModal 组件
3. **集成** - AutomationCenter 调用 Modal

## 验收标准

- [ ] 点击「添加」打开模态框
- [ ] 模态框有任务描述和专家选择两个输入
- [ ] 创建后自动解析自然语言生成定时任务
- [ ] 列表显示新创建的任务
- [ ] 任务显示正确的执行时间描述
