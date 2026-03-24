# 迭代 1：规则维护功能 - 执行计划

> **生成时间**：2026-03-24
> **迭代目标**：构建规则维护系统，支持会话初始化规则的 CRUD 操作
> **对应 PRD**：会话初始化规则管理
> **预计工时**：12-16 小时

---

## 1. 迭代概述

### 1.1 功能目标

规则是注入到 agent systemPrompt 中的模板文本，支持变量插值（如 `{{conversationId}}`）。本迭代实现：

- **CRUD 操作**：新增、查看、编辑、删除规则
- **启用/禁用**：控制规则是否在会话初始化时注入
- **优先级排序**：按优先级顺序注入规则
- **模板变量**：支持 `{{conversationId}}`、`{{workDir}}`、`{{cwd}}` 变量插值

### 1.2 技术方案

采用方案 A（简单规则表 + 模板变量）：
- 规则存储在 SQLite `rules` 表中
- 模板使用 `{{var}}` 语法进行变量插值
- Orchestrator 在会话初始化时加载启用的规则并渲染

### 1.3 依赖关系

```
BE-01 (数据模型) ──► BE-02 (迁移) ──► BE-03 (API) ──► BE-04 (服务层)
                                              │
                                              ▼
FE-01 (API 集成) ──► FE-02 (Store) ──► FE-03/04/05/06 (UI 组件)
                                              │
                                              ▼
                                      INT-01 (Orchestrator)
                                              │
                                              ▼
                                      INT-02 (迁移现有规则)
```

---

## 2. 任务清单

### 2.1 任务总览

| ID | 任务名称 | 类型 | 预计工时 | 依赖 |
|----|----------|------|----------|------|
| BE-01 | 数据模型设计 | 后端 | 0.5h | - |
| BE-02 | 数据库迁移 | 后端 | 0.5h | BE-01 |
| BE-03 | 规则 API 接口 | 后端 | 2h | BE-02 |
| BE-04 | 规则服务层 | 后端 | 1h | BE-03 |
| FE-01 | API 集成 | 前端 | 0.5h | BE-03 |
| FE-02 | 状态管理 | 前端 | 1h | FE-01 |
| FE-03 | 页面路由 | 前端 | 0.5h | FE-02 |
| FE-04 | 规则列表组件 | 前端 | 2h | FE-03 |
| FE-05 | 规则编辑弹窗 | 前端 | 2h | FE-04 |
| FE-06 | 规则卡片组件 | 前端 | 1h | FE-04 |
| INT-01 | Orchestrator 集成 | 集成 | 1h | BE-04 |
| INT-02 | 迁移现有规则 | 集成 | 0.5h | INT-01 |

---

## 3. 详细任务

### BE-01：数据模型设计

**目标**：创建 `rules` 表结构

**文件**：`apps/server/src/db/schema.sql`

**表结构**：

```sql
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  variables TEXT,
  is_enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);
```

**验收标准**：
- [ ] rules 表定义正确
- [ ] 索引已创建
- [ ] SQL 语法无误

---

### BE-02：数据库迁移

**目标**：添加迁移脚本创建 rules 表

**文件**：`apps/server/src/db/index.ts`

**修改要点**：
1. 在现有迁移逻辑中添加 Migration 8
2. 创建 rules 表
3. 创建索引

**代码示例**：[snippets/迭代1/BE-02_migration.ts](snippets/迭代1/BE-02_migration.ts)

**验收标准**：
- [ ] 迁移脚本可重复执行（幂等）
- [ ] 新数据库可正确创建 rules 表
- [ ] 现有数据库可增量迁移

---

### BE-03：规则 API 接口

**目标**：实现 `/api/v1/rules` CRUD 接口

**文件**：`apps/server/src/routes/rules.ts`

**接口定义**：

| 方法 | 端点 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/v1/rules` | 获取规则列表 | `?enabled=true/false` | `Rule[]` |
| GET | `/api/v1/rules/:id` | 获取单个规则 | - | `Rule` |
| POST | `/api/v1/rules` | 创建规则 | `CreateRuleInput` | `Rule` |
| PUT | `/api/v1/rules/:id` | 更新规则 | `UpdateRuleInput` | `Rule` |
| DELETE | `/api/v1/rules/:id` | 删除规则 | - | `{ success: true }` |
| PATCH | `/api/v1/rules/:id/toggle` | 启用/禁用 | `{ enabled: boolean }` | `Rule` |

**类型定义**：

```typescript
interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string | null;  // JSON 数组字符串
  is_enabled: number;        // 0 或 1
  priority: number;
  created_at: string;
  updated_at: string;
}

interface CreateRuleInput {
  name: string;
  description?: string;
  template: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}

interface UpdateRuleInput {
  name?: string;
  description?: string;
  template?: string;
  variables?: string[];
  is_enabled?: boolean;
  priority?: number;
}
```

**代码示例**：[snippets/迭代1/BE-03_rules-route.ts](snippets/迭代1/BE-03_rules-route.ts)

**验收标准**：
- [ ] GET /api/v1/rules 返回规则列表
- [ ] POST /api/v1/rules 创建规则成功
- [ ] PUT /api/v1/rules/:id 更新规则成功
- [ ] DELETE /api/v1/rules/:id 删除规则成功
- [ ] PATCH /api/v1/rules/:id/toggle 切换状态成功
- [ ] 路由已注册到 app.ts

---

### BE-04：规则服务层

**目标**：创建规则处理服务，支持模板变量插值

**文件**：`apps/server/src/services/ruleService.ts`

**核心函数**：

```typescript
// 获取所有启用的规则，按优先级降序
function getEnabledRules(): Rule[];

// 渲染规则模板，替换变量
function renderTemplate(template: string, variables: Record<string, string>): string;

// 为指定会话渲染所有启用的规则
function renderRulesForConversation(conversationId: string): string;
```

**模板变量**：

| 变量 | 说明 | 值来源 |
|------|------|--------|
| `{{conversationId}}` | 会话 ID | 传入参数 |
| `{{workDir}}` | 工作目录 | `${cwd}/data/conversations/${conversationId}` |
| `{{cwd}}` | 当前目录 | `process.cwd()` |

**代码示例**：[snippets/迭代1/BE-04_ruleService.ts](snippets/迭代1/BE-04_ruleService.ts)

**验收标准**：
- [ ] `getEnabledRules()` 返回按优先级排序的规则
- [ ] `renderTemplate()` 正确替换 `{{var}}` 变量
- [ ] `renderRulesForConversation()` 返回合并后的规则文本

---

### FE-01：API 集成

**目标**：在 `api.ts` 中添加规则 API 调用方法

**文件**：`apps/web/src/lib/api.ts`

**新增方法**：

```typescript
// 规则 API
export const rulesApi = {
  list: (enabled?: boolean) => fetch(`/api/v1/rules${enabled !== undefined ? `?enabled=${enabled}` : ''}`),
  get: (id: string) => fetch(`/api/v1/rules/${id}`),
  create: (data: CreateRuleInput) => fetch('/api/v1/rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateRuleInput) => fetch(`/api/v1/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetch(`/api/v1/rules/${id}`, { method: 'DELETE' }),
  toggle: (id: string, enabled: boolean) => fetch(`/api/v1/rules/${id}/toggle`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
};
```

**验收标准**：
- [ ] rulesApi 对象已导出
- [ ] 所有方法正确调用 API

---

### FE-02：状态管理

**目标**：创建规则 Zustand Store

**文件**：`apps/web/src/stores/ruleStore.ts`

**状态定义**：

```typescript
interface RuleState {
  rules: Rule[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRules: () => Promise<void>;
  createRule: (data: CreateRuleInput) => Promise<Rule>;
  updateRule: (id: string, data: UpdateRuleInput) => Promise<Rule>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string, enabled: boolean) => Promise<void>;
}
```

**代码示例**：[snippets/迭代1/FE-02_ruleStore.ts](snippets/迭代1/FE-02_ruleStore.ts)

**验收标准**：
- [ ] Store 正确管理 rules 状态
- [ ] fetchRules 加载规则列表
- [ ] createRule/updateRule/deleteRule 操作成功
- [ ] toggleRule 切换状态成功

---

### FE-03：页面路由

**目标**：添加规则管理页面入口

**修改文件**：
1. `apps/web/src/app/settings/rules/page.tsx` - 新建页面
2. `apps/web/src/components/layout/Sidebar.tsx` - 添加导航入口

**页面路由**：`/settings/rules`

**Sidebar 导航**：在设置菜单中添加"规则管理"入口

**验收标准**：
- [ ] `/settings/rules` 路由可访问
- [ ] Sidebar 有规则管理入口

---

### FE-04：规则列表组件

**目标**：实现规则列表展示

**文件**：`apps/web/src/components/rules/RuleList.tsx`

**功能**：
- 展示规则列表
- 显示规则名称、描述、状态、优先级
- 启用/禁用开关
- 编辑/删除操作

**代码示例**：[snippets/迭代1/FE-04_RuleList.tsx](snippets/迭代1/FE-04_RuleList.tsx)

**验收标准**：
- [ ] 规则列表正确显示
- [ ] 启用/禁用开关可切换
- [ ] 点击编辑打开弹窗
- [ ] 点击删除确认后删除

---

### FE-05：规则编辑弹窗

**目标**：实现规则新增/编辑弹窗

**文件**：`apps/web/src/components/rules/RuleModal.tsx`

**功能**：
- 表单字段：名称、描述、模板、变量、优先级、启用状态
- 表单验证
- 模板预览
- 变量提示（`{{conversationId}}`、`{{workDir}}`、`{{cwd}}`）

**表单字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | text | ✓ | 规则名称 |
| description | textarea | - | 规则描述 |
| template | textarea | ✓ | 规则模板 |
| variables | text | - | 变量列表（逗号分隔） |
| priority | number | - | 优先级（默认 0） |
| is_enabled | checkbox | - | 是否启用（默认启用） |

**验收标准**：
- [ ] 新建规则弹窗正常工作
- [ ] 编辑规则弹窗正确填充数据
- [ ] 表单验证生效
- [ ] 保存后刷新列表

---

### FE-06：规则卡片组件

**目标**：单条规则展示

**文件**：`apps/web/src/components/rules/RuleCard.tsx`

**功能**：
- 展示规则信息
- 启用/禁用开关
- 编辑/删除按钮

**验收标准**：
- [ ] 规则卡片正确展示
- [ ] 开关可切换状态
- [ ] 按钮触发正确操作

---

### INT-01：Orchestrator 集成

**目标**：修改 Orchestrator，在会话初始化时加载并注入规则

**文件**：`apps/server/src/services/orchestrator.ts`

**修改要点**：
1. 导入 `renderRulesForConversation` 函数
2. 在 `runViaGateway` 方法中，将规则文本注入到 systemPrompt
3. 在 `handleHandoff` 方法中，同样注入规则

**修改位置**：`runViaGateway` 方法（约 285 行）

```typescript
// 修改前
const enhancedSystemPrompt = (systemPrompt || agent.systemPrompt) + buildFileSavedProtocol(conversationId);

// 修改后
import { renderRulesForConversation } from './ruleService.js';
const enhancedSystemPrompt = (systemPrompt || agent.systemPrompt) + renderRulesForConversation(conversationId);
```

**验收标准**：
- [ ] 导入 ruleService 正确
- [ ] runViaGateway 注入规则成功
- [ ] handleHandoff 注入规则成功
- [ ] 规则按优先级顺序注入

---

### INT-02：迁移现有规则

**目标**：将 `buildFileSavedProtocol` 迁移为数据库种子数据

**修改要点**：
1. 在数据库初始化时插入默认规则
2. 保留 `buildFileSavedProtocol` 函数作为参考（可添加注释说明已迁移）

**种子数据**：

```sql
INSERT INTO rules (id, name, description, template, variables, is_enabled, priority)
VALUES (
  'rule_file_save_protocol',
  '文件保存协议',
  '定义文件保存的工作目录和标记格式',
  '## 文件保存协议
你的工作目录是: {{workDir}}/

当你保存文件时，必须：
1. 将文件保存到工作目录（绝对路径）: {{workDir}}/
2. 在消息末尾添加标记: [FILE_SAVED: 文件名或相对路径]

例如：
- 保存 notes.md 到 {{workDir}}/notes.md，消息中添加 [FILE_SAVED: notes.md]
- 保存 src/utils/helper.ts 到 {{workDir}}/src/utils/helper.ts，消息中添加 [FILE_SAVED: src/utils/helper.ts]

注意事项：
1. 只有在用户确认后才保存文件
2. 所有文件必须保存到工作目录 {{workDir}}/（这是绝对路径）
3. 每个保存的文件单独一行标记
4. 标记会被系统自动解析，不会显示给用户',
  '["conversationId", "workDir"]',
  1,
  100
);
```

**验收标准**：
- [ ] 默认规则已插入数据库
- [ ] 新用户启动时自动有默认规则
- [ ] 现有用户迁移后保持一致

---

## 4. 测试清单

### 4.1 后端测试

| 用例 ID | 描述 | 输入 | 预期输出 | 类型 |
|---------|------|------|----------|------|
| BE-TC-01 | 获取规则列表 | GET /api/v1/rules | 200, Rule[] | 正常 |
| BE-TC-02 | 过滤启用的规则 | GET /api/v1/rules?enabled=true | 200, 只返回 is_enabled=1 的规则 | 正常 |
| BE-TC-03 | 创建规则 | POST 有效数据 | 201, Rule 对象 | 正常 |
| BE-TC-04 | 创建规则缺少必填项 | POST 缺少 name | 400, 错误信息 | 异常 |
| BE-TC-05 | 更新规则 | PUT 部分数据 | 200, 更新后的 Rule | 正常 |
| BE-TC-06 | 删除规则 | DELETE /api/v1/rules/:id | 200, { success: true } | 正常 |
| BE-TC-07 | 切换规则状态 | PATCH { enabled: false } | 200, Rule | 正常 |
| BE-TC-08 | 模板变量插值 | renderTemplate("{{workDir}}", { workDir: "/tmp" }) | "/tmp" | 单元测试 |
| BE-TC-09 | 规则按优先级排序 | 多条规则不同优先级 | 按 priority 降序返回 | 单元测试 |

### 4.2 前端测试

| 用例 ID | 描述 | 操作 | 预期结果 | 类型 |
|---------|------|------|----------|------|
| FE-TC-01 | 页面加载 | 访问 /settings/rules | 显示规则列表 | 正常 |
| FE-TC-02 | 新建规则 | 点击新建 → 填写 → 保存 | 规则出现在列表中 | 正常 |
| FE-TC-03 | 编辑规则 | 点击编辑 → 修改 → 保存 | 规则更新成功 | 正常 |
| FE-TC-04 | 删除规则 | 点击删除 → 确认 | 规则从列表消失 | 正常 |
| FE-TC-05 | 切换状态 | 点击开关 | 状态立即切换 | 正常 |
| FE-TC-06 | 表单验证 | 不填必填项提交 | 显示错误提示 | 异常 |

### 4.3 集成测试

| 用例 ID | 描述 | 操作 | 预期结果 |
|---------|------|------|----------|
| INT-TC-01 | 规则注入到 systemPrompt | 创建规则 → 发起对话 | AI 响应中遵循规则 |
| INT-TC-02 | 规则优先级生效 | 两个规则不同优先级 | 按优先级顺序注入 |
| INT-TC-03 | 禁用规则不注入 | 禁用规则 → 发起对话 | systemPrompt 不包含该规则 |

---

## 5. 进度跟踪

### 5.1 任务状态

| 任务 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| BE-01 数据模型设计 | ✅ 已完成 | 2026-03-24 | |
| BE-02 数据库迁移 | ✅ 已完成 | 2026-03-24 | |
| BE-03 规则 API 接口 | ✅ 已完成 | 2026-03-24 | |
| BE-04 规则服务层 | ✅ 已完成 | 2026-03-24 | |
| FE-01 API 集成 | ✅ 已完成 | 2026-03-24 | |
| FE-02 状态管理 | ✅ 已完成 | 2026-03-24 | |
| FE-03 页面路由 | ✅ 已完成 | 2026-03-24 | |
| FE-04 规则列表组件 | ✅ 已完成 | 2026-03-24 | |
| FE-05 规则编辑弹窗 | ✅ 已完成 | 2026-03-24 | |
| FE-06 规则卡片组件 | ✅ 已完成 | 2026-03-24 | |
| INT-01 Orchestrator 集成 | ✅ 已完成 | 2026-03-24 | |
| INT-02 迁移现有规则 | ✅ 已完成 | 2026-03-24 | |

### 5.2 里程碑

| 里程碑 | 包含任务 | 目标日期 |
|--------|----------|----------|
| M1: 后端完成 | BE-01 ~ BE-04 | - |
| M2: 前端完成 | FE-01 ~ FE-06 | - |
| M3: 集成完成 | INT-01 ~ INT-02 | - |
| M4: 测试通过 | 所有测试 | - |

---

## 6. 风险与备注

### 6.1 已知风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 模板变量冲突 | 如果规则模板包含 `{{` 字符串但不是变量，会被错误替换 | 使用转义语法或正则精确匹配 |
| 规则过多影响性能 | 大量规则注入可能导致 systemPrompt 过长 | 限制规则数量或总长度 |

### 6.2 备注

- 迁移后 `buildFileSavedProtocol` 函数可保留作为参考
- 前端 UI 参考 UX 设计文档 4.6 节

---

## 更新记录

| 日期 | 变更内容 |
|------|----------|
| 2026-03-24 | 初始化：生成迭代 1 执行计划 |
