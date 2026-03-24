# Openclaw Dashboard - 项目待办清单

> 基于 PRD v1.0 生成
> 最后更新：2026-03-24
> 当前进度: 迭代 1 / 共 1 个迭代

> **📋 执行计划**：[plan_迭代1.md](../plan/plan_迭代1.md)

---

## 迭代计划总览

| 迭代 | 目标 | 后端任务 | 前端任务 | 完成度 | 状态 |
|------|------|---------|---------|--------|------|
| 迭代 1 | 规则维护功能 | 4/4 | 6/6 | 12/12 | ✅ |

---

## 迭代 1：规则维护功能 ✅

> 📋 对应 PRD 功能：会话初始化规则管理
> 📊 进度：12/12 任务完成
> ✅ 完成时间：2026-03-24

### 功能概述

构建规则维护系统，支持会话初始化规则的 CRUD 操作。规则是注入到 agent system prompt 中的模板文本，支持变量插值（如 `{{conversationId}}`）。参考现有 `buildFileSavedProtocol` 的实现方式。

### 后端任务

- [x] **BE-01 数据模型设计** - 创建 `rules` 表结构 ✅
  - 字段：id, name, description, template, variables (JSON), is_enabled, priority, created_at, updated_at
  - 文件：`apps/server/src/db/schema.sql`

- [x] **BE-02 数据库迁移** - 添加迁移脚本创建 rules 表 ✅
  - 文件：`apps/server/src/db/index.ts` 迁移逻辑

- [x] **BE-03 规则 API 接口** - 实现 `/api/v1/rules` CRUD ✅
  - GET /api/v1/rules - 获取规则列表（支持 enabled 过滤）
  - GET /api/v1/rules/:id - 获取单个规则
  - POST /api/v1/rules - 创建规则
  - PUT /api/v1/rules/:id - 更新规则
  - DELETE /api/v1/rules/:id - 删除规则
  - PATCH /api/v1/rules/:id/toggle - 启用/禁用规则
  - 文件：`apps/server/src/routes/rules.ts`

- [x] **BE-04 规则服务层** - 创建规则处理服务 ✅
  - 模板变量插值函数
  - 获取启用的规则并渲染
  - 文件：`apps/server/src/services/ruleService.ts`

### 前端任务

- [x] **FE-01 API 集成** - 添加规则 API 调用方法 ✅
  - 文件：`apps/web/src/lib/api.ts`

- [x] **FE-02 状态管理** - 创建规则 Zustand Store ✅
  - 文件：`apps/web/src/stores/ruleStore.ts`

- [x] **FE-03 页面路由** - 添加规则管理页面入口 ✅
  - 路由：`/settings/rules`
  - 导航：在 Sidebar 设置菜单添加入口

- [x] **FE-04 规则列表组件** - 实现规则列表展示 ✅
  - 文件：`apps/web/src/components/rules/RuleList.tsx`
  - 功能：列表展示、启用/禁用开关、删除操作

- [x] **FE-05 规则编辑弹窗** - 实现规则新增/编辑 ✅
  - 文件：`apps/web/src/components/rules/RuleModal.tsx`
  - 功能：表单验证、模板预览、变量提示

- [x] **FE-06 规则卡片组件** - 单条规则展示 ✅
  - 文件：`apps/web/src/components/rules/RuleCard.tsx`

### 集成任务

- [x] **INT-01 Orchestrator 集成** - 修改会话初始化逻辑 ✅
  - 在 `runViaGateway` 中加载启用的规则
  - 渲染模板变量并注入 systemPrompt
  - 文件：`apps/server/src/services/orchestrator.ts`

- [x] **INT-02 迁移现有规则** - 将硬编码规则迁移到数据库 ✅
  - 迁移 `buildFileSavedProtocol` 为种子数据
  - 添加到数据库初始化脚本

---

## 数据模型参考

### Rule 实体

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | UUID，前缀 `rule_` |
| name | TEXT | NOT NULL | 规则名称 |
| description | TEXT | - | 规则描述 |
| template | TEXT | NOT NULL | 规则模板（支持 `{{var}}` 变量） |
| variables | TEXT | - | JSON 定义变量，如 `["conversationId"]` |
| is_enabled | INTEGER | DEFAULT 1 | 是否启用 (0/1) |
| priority | INTEGER | DEFAULT 0 | 优先级（越大越先注入） |
| created_at | DATETIME | - | 创建时间 |
| updated_at | DATETIME | - | 更新时间 |

### 模板变量

| 变量 | 说明 | 来源 |
|------|------|------|
| `{{conversationId}}` | 当前会话 ID | orchestrator |
| `{{workDir}}` | 会话工作目录 | orchestrator |
| `{{cwd}}` | 服务器当前目录 | process.cwd() |

---

## 更新记录

| 日期 | 变更内容 |
|------|----------|
| 2026-03-23 | 初始化：创建迭代 1 规则维护功能 |
