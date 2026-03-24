# Openclaw Dashboard - 设计总览

> **最后更新**: 2026-03-21
> **文档状态**: ✅ 已完成

---

## 1. MVP 功能范围

> 来源: `01_PRD.md` - ⏳ 待生成

### 功能边界图

```
┌─────────────────────────────────────────────────────────────┐
│                    Openclaw Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   会话管理   │  │   聊天面板   │  │   多 Agent 协作     │  │
│  │ - 创建/删除  │  │ - 流式响应   │  │ - Agent 选择       │  │
│  │ - 重命名     │  │ - 乐观更新   │  │ - Agent 交接       │  │
│  │ - 置顶       │  │ - 任务卡片   │  │ - 虚拟 Agent       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   专家系统   │  │   自动化     │  │   产物管理          │  │
│  │ - CRUD      │  │ - Cron 调度  │  │ - 文件存储         │  │
│  │ - 分类      │  │ - 自然语言   │  │ - 代码块提取       │  │
│  │ - 默认专家   │  │ - 手动触发   │  │ - 预览/下载        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     任务管理                           │  │
│  │  - 任务协议 (TASK:START/PROGRESS/DONE/FAILED)         │  │
│  │  - 进度追踪  - 输出管理  - 取消任务                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     规则维护                           │  │
│  │  - 会话初始化规则 CRUD  - 启用/禁用  - 模板变量插值   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心用户故事

| 编号 | 作为 | 我想要 | 以便于 |
|------|------|--------|--------|
| US-001 | 技术用户 | 与 AI Agent 进行对话交流 | 获取技术支持和建议 |
| US-002 | 技术用户 | 查看流式响应 | 实时看到 AI 的回复进度 |
| US-003 | 技术用户 | 管理多个会话 | 组织不同主题的对话 |
| US-004 | 技术用户 | 选择不同的专家 | 获得特定领域的专业建议 |
| US-005 | 技术用户 | 设置自动化任务 | 定期执行重复性工作 |
| US-006 | 技术用户 | 查看和下载产物 | 获取 AI 生成的文件 |
| US-009 | 高级用户 | 配置会话初始化规则 | 自定义 AI 行为约束 |

---

## 2. 系统架构

> 来源: `02_TECH.md` - ⏳ 待生成

### 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端框架** | Next.js | 14.x | SSR/SSG 框架 |
| **UI 框架** | React | 18.x | 组件化 UI |
| **样式** | Tailwind CSS | 3.x | 原子化 CSS |
| **状态管理** | Zustand | 4.x | 全局状态 |
| **后端框架** | Fastify | 4.x | 高性能 API |
| **数据库** | SQLite | - | 轻量级存储 |
| **实时通信** | WebSocket | - | 双向通信 |
| **类型验证** | Zod | 3.x | 运行时校验 |
| **语言** | TypeScript | 5.x | 类型安全 |

### 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Sidebar   │  │ MainContent│  │    ArtifactsPanel     │  │
│  │  会话列表   │  │ ChatPanel  │  │      产物面板          │  │
│  │  导航菜单   │  │ ExpertCenter│  │                       │  │
│  │            │  │ AutoCenter │  │                       │  │
│  └─────┬──────┘  └─────┬──────┘  └───────────┬────────────┘  │
│        │               │                      │               │
│        └───────────────┼──────────────────────┘               │
│                        │                                      │
│              ┌─────────▼─────────┐                            │
│              │   Zustand Store   │                            │
│              │   useWebSocket    │                            │
│              └─────────┬─────────┘                            │
└────────────────────────┼─────────────────────────────────────┘
                         │ WebSocket + REST API
┌────────────────────────▼─────────────────────────────────────┐
│                      Backend (Fastify)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Routes    │  │ Services   │  │      Storage           │  │
│  │  websocket │  │ orchestrator│  │  SQLite (better-sqlite)│  │
│  │  rest api  │  │ taskManager │  │  File System           │  │
│  │            │  │ artifactStg │  │                        │  │
│  └─────┬──────┘  └─────┬──────┘  └────────────────────────┘  │
└────────┼───────────────┼─────────────────────────────────────┘
         │               │
         │    ┌──────────▼──────────┐
         │    │  Openclaw Gateway   │
         └────►  (WebSocket)        │
              │  - Agent 通信       │
              │  - 事件流           │
              └─────────────────────┘
```

### 目录结构

```
openclaw-dashboard/
├── apps/
│   ├── web/                    # Next.js 前端
│   │   └── src/
│   │       ├── app/            # 页面路由
│   │       ├── components/     # UI 组件
│   │       │   ├── chat/       # 聊天组件
│   │       │   ├── expert/     # 专家组件
│   │       │   ├── automation/ # 自动化组件
│   │       │   ├── category/   # 分类组件
│   │       │   ├── task/       # 任务组件
│   │       │   └── layout/     # 布局组件
│   │       ├── hooks/          # 自定义 Hooks
│   │       ├── stores/         # Zustand Store
│   │       └── lib/            # 工具库
│   │
│   └── server/                 # Fastify 后端
│       └── src/
│           ├── routes/         # API 路由
│           ├── services/       # 业务服务
│           ├── db/             # 数据库
│           └── index.ts        # 入口
│
├── packages/
│   ├── shared/                 # 共享类型
│   └── dashboard-plugin/       # Openclaw 插件
│
└── docs/
    └── prd/                    # 设计文档
```

### 部署配置

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| Web (开发) | 3000 | `pnpm --filter web dev` |
| Server (开发) | 3002 | `pnpm --filter server dev` |
| Web (生产) | 3000 | `pnpm --filter web build && pnpm --filter web start` |
| Server (生产) | 3002 | `pnpm --filter server build && node apps/server/dist/index.js` |

---

## 3. 数据模型

> 来源: `03_DATAMODEL.md` - ⏳ 待生成

### 实体关系图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Conversation │       │   Message    │       │    Task      │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │───┐   │ id (PK)      │   ┌───│ id (PK)      │
│ title        │   │   │ conv_id (FK) │───┘   │ conv_id (FK) │
│ pinned       │   │   │ role         │       │ type         │
│ expert_id    │   │   │ content      │       │ title        │
│ created_at   │   │   │ msg_type     │       │ status       │
│ updated_at   │   │   │ task_id (FK) │       │ progress     │
└──────────────┘   │   │ metadata     │       │ prog_msg     │
       │           │   └──────────────┘       │ error_msg    │
       │           │                          └──────────────┘
       │           │
       │           │   ┌──────────────┐       ┌──────────────┐
       │           │   │   Artifact   │       │  Automation  │
       │           │   ├──────────────┤       ├──────────────┤
       │           └──►│ id (PK)      │       │ id (PK)      │
       │               │ conv_id (FK) │       │ title        │
       │               │ task_id (FK) │       │ agent_id     │
       │               │ type         │       │ schedule     │
       │               │ title        │       │ status       │
       │               │ content      │       │ last_run_at  │
       │               │ file_path    │       │ next_run_at  │
       │               └──────────────┘       └──────────────┘
       │
       ▼
┌──────────────┐       ┌──────────────┐
│    Expert    │       │   Category   │
├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │
│ name         │       │ name         │
│ avatar       │       │ description  │
│ title        │       │ sort_order   │
│ description  │       └──────────────┘
│ category     │              ▲
│ system_prompt│──────────────┘
│ color        │
│ icon         │
│ is_default   │
└──────────────┘
```

### 核心实体说明

| 实体 | 说明 | 主要关系 |
|------|------|----------|
| **Conversation** | 会话 | has_many Messages, Tasks, Artifacts |
| **Message** | 消息 | belongs_to Conversation, Task |
| **Task** | 任务 | belongs_to Conversation |
| **Expert** | 专家 | belongs_to Category |
| **Category** | 分类 | has_many Experts |
| **Automation** | 自动化 | 独立实体 |
| **Artifact** | 产物 | belongs_to Conversation, Task |
| **Rule** | 规则 | 独立实体，会话初始化注入 |

---

## 4. 页面设计

> 来源: `04_UX_DESIGN.md` - ⏳ 待生成

### 页面层级

```
Dashboard
│
├── 主页面 (/)                        # 核心聊天界面
│   │
│   ├── Sidebar                       # 左侧边栏
│   │   ├── Logo                      # 品牌标识
│   │   ├── NewChatButton             # 新建会话
│   │   ├── ConversationList          # 会话列表
│   │   │   ├── PinnedSection         # 置顶区
│   │   │   └── AllSection            # 全部区
│   │   ├── SearchBar                 # 搜索框
│   │   └── NavigationMenu            # 导航菜单
│   │       ├── ClawNavItem           # 聊天入口
│   │       ├── ExpertNavItem         # 专家入口
│   │       └── AutomationNavItem     # 自动化入口
│   │
│   ├── MainContent                   # 主内容区
│   │   ├── ChatPanel                 # 聊天面板
│   │   │   ├── MessageList           # 消息列表
│   │   │   ├── MessageItem           # 单条消息
│   │   │   ├── TaskCard              # 任务卡片
│   │   │   ├── StreamingCursor       # 流式光标
│   │   │   └── InputBar              # 输入栏
│   │   │       └── RoleSelector      # 角色选择
│   │   │
│   │   ├── ExpertCenter              # 专家中心
│   │   │   ├── ExpertGrid            # 专家网格
│   │   │   ├── ExpertCard            # 专家卡片
│   │   │   └── ExpertModal           # 专家编辑弹窗
│   │   │
│   │   └── AutomationCenter          # 自动化中心
│   │       ├── AutomationList        # 自动化列表
│   │       ├── AutomationItem        # 自动化项
│   │       └── AutomationModal       # 自动化编辑弹窗
│   │
│   └── ArtifactsPanel                # 右侧产物面板
│       ├── ArtifactsHeader           # 标题栏
│       └── ArtifactsList             # 产物列表
│
└── 设置页面
    ├── /settings/categories          # 分类管理
    │   └── CategoryManager           # 分类管理器
    │       ├── CategoryList          # 分类列表
    │       └── CategoryModal         # 分类编辑弹窗
    │
    └── /settings/rules               # 规则管理
        └── RuleManager               # 规则管理器
            ├── RuleList              # 规则列表
            ├── RuleCard              # 规则卡片
            └── RuleModal             # 规则编辑弹窗
```

### 核心页面结构

**主页面布局 (1920x1080)**

```
┌────────────────────────────────────────────────────────────────────┐
│  ┌───────────┐  ┌─────────────────────────┐  ┌────────────────┐   │
│  │           │  │                         │  │                │   │
│  │  Sidebar  │  │      MainContent        │  │ ArtifactsPanel │   │
│  │  (260px)  │  │      (flexible)         │  │    (320px)     │   │
│  │           │  │                         │  │                │   │
│  │  会话列表  │  │  MessageList /         │  │   产物列表      │   │
│  │  导航菜单  │  │  ExpertCenter /        │  │   预览/下载     │   │
│  │           │  │  AutomationCenter      │  │                │   │
│  │           │  │                         │  │                │   │
│  │           │  │  ─────────────────────  │  │                │   │
│  │           │  │  InputBar (固定底部)    │  │                │   │
│  │           │  │                         │  │                │   │
│  └───────────┘  └─────────────────────────┘  └────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. 文档索引

| 文档 | 状态 | 说明 |
|------|------|------|
| [00_PRD_GRAPH.md](./00_PRD_GRAPH.md) | ✅ 当前 | 设计总览（入口） |
| [01_PRD.md](./01_PRD.md) | ✅ 已完成 | 产品需求文档 |
| [02_TECH.md](./02_TECH.md) | ✅ 已完成 | 技术架构文档 |
| [03_DATAMODEL.md](./03_DATAMODEL.md) | ✅ 已完成 | 数据模型文档 |
| [04_UX_DESIGN.md](./04_UX_DESIGN.md) | ✅ 已完成 | UX 设计文档 |
| [05_API.md](./05_API.md) | ✅ 已完成 | API 文档 |
| [06_TODOLIST.md](./06_TODOLIST.md) | - | 迭代计划（可选） |

---

## 6. 规则索引

| 规则文件 | 说明 |
|----------|------|
| [CLAUDE.md](../../CLAUDE.md) | 项目开发规范 |

---

## 7. 更新记录

| 日期 | 文档 | 变更内容 |
|------|------|----------|
| 2026-03-23 | 00_PRD_GRAPH.md | 新增规则维护功能模块 |
| 2026-03-21 | 00_PRD_GRAPH.md | 初始化设计总览 |

---

## 下一步

选择要生成的详细文档：

1. **01_PRD.md** - 产品需求文档
2. **02_TECH.md** - 技术架构文档
3. **03_DATAMODEL.md** - 数据模型文档
4. **04_UX_DESIGN.md** - UX 设计文档
