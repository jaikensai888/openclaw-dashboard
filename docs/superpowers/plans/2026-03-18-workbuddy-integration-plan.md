# WorkBuddy 功能融合实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 WorkBuddy 的产物面板、专家中心、自动化中心功能融合到 Openclaw Dashboard

**Architecture:** 三栏布局架构 - Sidebar（扩展导航）+ MainContent（视图切换）+ ArtifactsPanel（右侧滑出）。使用 Zustand 扩展状态管理，Fastify 路由扩展后端 API。

**Tech Stack:** Next.js 14, Fastify, SQLite (sql.js), Zustand, Tailwind CSS, Lucide React

**Design Doc:** `docs/superpowers/specs/2026-03-18-workbuddy-integration-design.md`

---

## File Structure

### New Files to Create

```
# Frontend Components
apps/web/src/components/layout/ArtifactsPanel.tsx     # 产物面板组件
apps/web/src/components/expert/ExpertCenter.tsx       # 专家中心视图
apps/web/src/components/expert/ExpertCard.tsx         # 专家卡片组件
apps/web/src/components/automation/AutomationCenter.tsx  # 自动化中心视图
apps/web/src/components/automation/AutomationItem.tsx    # 自动化任务项组件
apps/web/src/components/chat/RoleSelector.tsx         # 角色选择器组件

# Backend Routes
apps/server/src/routes/experts.ts                     # 专家 API 路由
apps/server/src/routes/automations.ts                 # 自动化 API 路由
apps/server/src/routes/artifacts.ts                   # 产物 API 路由
apps/server/src/services/scheduler.ts                 # 调度服务

# Types (shared)
packages/shared/src/types/expert.ts                   # 专家类型定义
packages/shared/src/types/automation.ts               # 自动化类型定义
packages/shared/src/types/artifact.ts                 # 产物类型定义
```

### Files to Modify

```
apps/web/src/stores/chatStore.ts                      # 扩展状态管理
apps/web/src/components/layout/Sidebar.tsx            # 添加导航入口、搜索框
apps/web/src/components/layout/MainContent.tsx        # 支持视图切换
apps/web/src/components/chat/InputBar.tsx             # 添加角色选择器
apps/web/src/components/chat/ChatPanel.tsx            # 添加产物按钮
apps/server/src/db/schema.sql                         # 添加新表
apps/server/src/db/index.ts                           # 添加迁移
apps/server/src/app.ts                                # 注册新路由
```

---

## Chunk 1: Phase 1 - 基础架构重构

### Task 1.1: 数据库 Schema 扩展

**Files:**
- Modify: `apps/server/src/db/schema.sql`
- Modify: `apps/server/src/db/index.ts`

- [ ] **Step 1: 添加新表到 schema.sql**

在 `apps/server/src/db/schema.sql` 末尾添加：

```sql
-- Experts table (专家/角色)
CREATE TABLE IF NOT EXISTS experts (
    id TEXT PRIMARY KEY,              -- UUID, format: expert_xxx
    name TEXT NOT NULL,               -- 专家名称
    avatar TEXT,                      -- 头像 URL
    title TEXT NOT NULL,              -- 头衔
    description TEXT,                 -- 简介
    category TEXT NOT NULL,           -- 分类
    system_prompt TEXT NOT NULL,      -- 系统提示词
    color TEXT,                       -- 主题色
    icon TEXT,                        -- 图标
    is_default INTEGER DEFAULT 0,     -- 是否为默认角色
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automations table (自动化任务)
CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,              -- UUID, format: auto_xxx
    title TEXT NOT NULL,              -- 任务名称
    description TEXT,                 -- 任务描述
    agent_id TEXT NOT NULL,           -- 执行的 Agent ID
    schedule TEXT NOT NULL,           -- Cron 表达式
    schedule_description TEXT,        -- 人类可读的调度描述
    status TEXT DEFAULT 'active',     -- 'active' | 'paused' | 'deleted'
    last_run_at DATETIME,             -- 上次执行时间
    next_run_at DATETIME,             -- 下次执行时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Artifacts table (产物)
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,              -- UUID, format: artifact_xxx
    conversation_id TEXT NOT NULL,    -- 所属会话
    task_id TEXT,                     -- 关联任务（可选）
    type TEXT NOT NULL,               -- 'document' | 'code' | 'image' | 'file'
    title TEXT NOT NULL,              -- 产物标题
    content TEXT,                     -- 产物内容
    file_path TEXT,                   -- 文件路径
    mime_type TEXT,                   -- MIME 类型
    metadata TEXT,                    -- JSON 元数据
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_experts_category ON experts(category);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id);
```

- [ ] **Step 2: 添加迁移到 db/index.ts**

在 `runMigrations` 函数中添加新表迁移：

```typescript
/**
 * Run database migrations for existing databases
 */
function runMigrations(database: SqlJsDatabase): void {
  // Migration 1: Add pinned column to conversations if missing
  try {
    const columns = database.exec("PRAGMA table_info(conversations)");
    const columnNames = columns[0]?.values?.map((v) => v[1] as string) || [];

    if (!columnNames.includes('pinned')) {
      console.log('[DB] Migration: Adding pinned column to conversations');
      database.run("ALTER TABLE conversations ADD COLUMN pinned INTEGER DEFAULT 0");
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 2: Add expert_id column to conversations if missing
  try {
    const columns = database.exec("PRAGMA table_info(conversations)");
    const columnNames = columns[0]?.values?.map((v) => v[1] as string) || [];

    if (!columnNames.includes('expert_id')) {
      console.log('[DB] Migration: Adding expert_id column to conversations');
      database.run("ALTER TABLE conversations ADD COLUMN expert_id TEXT");
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 3: Create experts table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS experts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_experts_category ON experts(category)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 4: Create automations table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        agent_id TEXT NOT NULL,
        schedule TEXT NOT NULL,
        schedule_description TEXT,
        status TEXT DEFAULT 'active',
        last_run_at DATETIME,
        next_run_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }

  // Migration 5: Create artifacts table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        task_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        file_path TEXT,
        mime_type TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id)`);
    database.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id)`);
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
}
```

- [ ] **Step 3: 测试数据库迁移**

启动服务器验证表创建成功：

```bash
cd apps/server && pnpm dev
```

Expected: 服务器启动成功，日志显示迁移完成

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema.sql apps/server/src/db/index.ts
git commit -m "feat(db): 添加 experts、automations、artifacts 表结构和迁移"
```

---

### Task 1.2: Zustand Store 扩展

**Files:**
- Modify: `apps/web/src/stores/chatStore.ts`

- [ ] **Step 1: 添加类型定义**

在 chatStore.ts 顶部添加新类型：

```typescript
// 新增类型定义
type ViewType = 'chat' | 'expert' | 'automation';

interface Expert {
  id: string;
  name: string;
  avatar?: string;
  title: string;
  description?: string;
  category: string;
  systemPrompt: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Automation {
  id: string;
  title: string;
  description?: string;
  agentId: string;
  schedule: string;
  scheduleDescription?: string;
  status: 'active' | 'paused' | 'deleted';
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Artifact {
  id: string;
  conversationId: string;
  taskId?: string;
  type: 'document' | 'code' | 'image' | 'file';
  title: string;
  content?: string;
  filePath?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: 扩展 ChatState 接口**

在 `ChatState` 接口中添加新状态：

```typescript
interface ChatState {
  // ... 现有状态

  // 新增：视图状态
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  // 新增：产物面板状态
  artifactsPanelOpen: boolean;
  toggleArtifactsPanel: () => void;
  setArtifactsPanelOpen: (open: boolean) => void;

  // 新增：专家相关状态
  experts: Expert[];
  setExperts: (experts: Expert[]) => void;
  currentExpertId: string | null;
  setCurrentExpertId: (id: string | null) => void;

  // 新增：自动化相关状态
  automations: Automation[];
  setAutomations: (automations: Automation[]) => void;

  // 新增：产物相关状态
  artifacts: Artifact[];
  setArtifacts: (artifacts: Artifact[]) => void;
  selectedArtifactId: string | null;
  setSelectedArtifactId: (id: string | null) => void;

  // 新增：搜索过滤
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}
```

- [ ] **Step 3: 实现新状态和方法**

在 `create` 函数中添加实现：

```typescript
export const useChatStore = create<ChatState>((set, get) => ({
  // ... 现有实现

  // 视图状态
  currentView: 'chat',
  setCurrentView: (view) => set({ currentView: view }),

  // 产物面板状态
  artifactsPanelOpen: false,
  toggleArtifactsPanel: () => set((state) => ({ artifactsPanelOpen: !state.artifactsPanelOpen })),
  setArtifactsPanelOpen: (open) => set({ artifactsPanelOpen: open }),

  // 专家相关状态
  experts: [],
  setExperts: (experts) => set({ experts }),
  currentExpertId: null,
  setCurrentExpertId: (id) => set({ currentExpertId: id }),

  // 自动化相关状态
  automations: [],
  setAutomations: (automations) => set({ automations }),

  // 产物相关状态
  artifacts: [],
  setArtifacts: (artifacts) => set({ artifacts }),
  selectedArtifactId: null,
  setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),

  // 搜索过滤
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

// 导出新类型
export type { ViewType, Expert, Automation, Artifact };
```

- [ ] **Step 4: 更新 Conversation 类型**

在 Conversation 接口中添加 expertId：

```typescript
interface Conversation {
  id: string;
  title?: string | null;
  pinned: boolean;
  expertId?: string | null;  // 新增
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/stores/chatStore.ts
git commit -m "feat(store): 扩展 chatStore 支持视图切换、专家、自动化、产物状态"
```

---

### Task 1.3: MainContent 视图切换重构

**Files:**
- Modify: `apps/web/src/components/layout/MainContent.tsx`

- [ ] **Step 1: 添加视图切换逻辑**

```tsx
'use client';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatStore } from '@/stores/chatStore';
import { MessageSquare, Sparkles } from 'lucide-react';

export function MainContent() {
  const { currentConversationId, currentView } = useChatStore();

  // 根据当前视图渲染不同内容
  const renderView = () => {
    switch (currentView) {
      case 'expert':
        return (
          <div className="flex-1 flex items-center justify-center bg-neutral-900">
            <div className="text-center text-neutral-500">
              <p>专家中心 - 开发中</p>
            </div>
          </div>
        );
      case 'automation':
        return (
          <div className="flex-1 flex items-center justify-center bg-neutral-900">
            <div className="text-center text-neutral-500">
              <p>自动化中心 - 开发中</p>
            </div>
          </div>
        );
      case 'chat':
      default:
        if (!currentConversationId) {
          return (
            <main id="main-content" className="flex-1 flex items-center justify-center bg-neutral-900" role="main">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-neutral-800 focus:p-2 focus:rounded"
              >
                Skip to main content
              </a>
              <div className="text-center text-neutral-500 max-w-md px-4">
                <div className="mb-6">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary-500 opacity-50" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-semibold mb-3 text-neutral-200">
                  欢迎使用 Openclaw Dashboard
                </h1>
                <p className="text-sm mb-6">
                  点击「新对话」开始与 AI 交流
                </p>
                <div className="flex flex-col gap-2 text-xs text-neutral-600">
                  <p>实时聊天 - 类似 ChatGPT 的聊天体验</p>
                  <p>任务追踪 - 通过内联标记识别任务状态</p>
                  <p>流式响应 - 实时显示 Agent 回复</p>
                </div>
              </div>
            </main>
          );
        }
        return (
          <main id="main-content" className="flex-1 flex flex-col bg-neutral-900" role="main">
            <a
              href="#chat-input"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-neutral-800 focus:p-2 focus:rounded"
            >
              Skip to chat input
            </a>
            <ChatPanel />
          </main>
        );
    }
  };

  return renderView();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/MainContent.tsx
git commit -m "feat(layout): MainContent 支持视图切换（chat/expert/automation）"
```

---

### Task 1.4: Sidebar 扩展 - 导航入口

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 添加搜索框和导航入口**

在 Sidebar 组件中添加：

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Plus, Settings, Trash2, Menu, X, Pin, Pencil, Check,
  Search, Bot, User, Clock  // 新增图标
} from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

// 导航项组件
function NavItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500',
        isActive ? 'bg-primary-600 text-white' : 'hover:bg-neutral-700 text-neutral-300'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1 text-left text-sm">{label}</span>
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-600 text-neutral-300">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar() {
  const {
    sidebarOpen,
    conversations,
    currentConversationId,
    currentView,
    setCurrentView,
    setCurrentConversation,
    createConversation,
    toggleSidebar,
    searchQuery,
    setSearchQuery,
  } = useChatStore();
  const { switchConversation, createConversation: createConversationWS, renameConversation, togglePinConversation, deleteConversation } = useWebSocket();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ... 现有的 useEffect 和处理函数

  // 过滤会话列表
  const filteredConversations = conversations.filter((c) =>
    !searchQuery || (c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const pinnedConversations = filteredConversations.filter((c) => c.pinned);
  const unpinnedConversations = filteredConversations.filter((c) => !c.pinned);

  // ... 现有的 ConversationItem 组件

  // Mobile: Show hamburger menu when sidebar is closed
  if (!sidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-40 p-3 bg-neutral-800 rounded-lg md:hidden hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      <aside className="fixed md:relative inset-y-0 left-0 w-72 md:w-64 bg-neutral-800 flex flex-col border-r border-neutral-700 z-40 md:z-auto h-full">
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Openclaw</h1>
          <div className="flex items-center gap-1">
            <button
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="设置"
            >
              <Settings className="w-4 h-4 text-neutral-400" />
            </button>
            <button
              onClick={toggleSidebar}
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-neutral-700 transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="关闭菜单"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Search - 新增 */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索任务..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4" />
            <span>新对话</span>
          </button>
        </div>

        {/* Navigation - 新增 */}
        <div className="px-3 py-2 space-y-1 border-b border-neutral-700">
          <NavItem
            icon={Bot}
            label="Claw"
            isActive={currentView === 'chat'}
            onClick={() => setCurrentView('chat')}
          />
          <NavItem
            icon={User}
            label="专家"
            isActive={currentView === 'expert'}
            onClick={() => setCurrentView('expert')}
          />
          <NavItem
            icon={Clock}
            label="自动化"
            isActive={currentView === 'automation'}
            onClick={() => setCurrentView('automation')}
            badge="Beta"
          />
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? '没有匹配的会话' : '暂无对话'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Pinned conversations */}
              {pinnedConversations.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs text-neutral-500 font-medium">置顶</div>
                  {pinnedConversations.map((conv) => (
                    <ConversationItem key={conv.id} conv={conv} />
                  ))}
                  {unpinnedConversations.length > 0 && (
                    <div className="my-2 border-t border-neutral-700" />
                  )}
                </>
              )}

              {/* Unpinned conversations */}
              {unpinnedConversations.length > 0 && pinnedConversations.length > 0 && (
                <div className="px-3 py-2 text-xs text-neutral-500 font-medium">对话</div>
              )}
              {unpinnedConversations.map((conv) => (
                <ConversationItem key={conv.id} conv={conv} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
            <span>已连接</span>
          </div>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): 添加导航入口（Claw/专家/自动化）和搜索框"
```

---

### Task 1.5: ArtifactsPanel 基础组件

**Files:**
- Create: `apps/web/src/components/layout/ArtifactsPanel.tsx`

- [ ] **Step 1: 创建 ArtifactsPanel 组件**

```tsx
'use client';

import { X, FileText, Code, Image, File, ExternalLink } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

type TabType = 'artifacts' | 'files' | 'changes' | 'preview';

const tabs: { id: TabType; label: string }[] = [
  { id: 'artifacts', label: '产物' },
  { id: 'files', label: '全部文件' },
  { id: 'changes', label: '变更' },
  { id: 'preview', label: '预览' },
];

export function ArtifactsPanel() {
  const {
    artifactsPanelOpen,
    setArtifactsPanelOpen,
    artifacts,
    selectedArtifactId,
    setSelectedArtifactId,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<TabType>('artifacts');

  if (!artifactsPanelOpen) return null;

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'code':
        return Code;
      case 'image':
        return Image;
      case 'document':
      default:
        return FileText;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={() => setArtifactsPanelOpen(false)}
      />

      {/* Panel */}
      <aside className="fixed lg:relative right-0 top-0 h-full w-80 lg:w-96 bg-neutral-800 border-l border-neutral-700 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-sm font-medium">产物面板</h2>
          <button
            onClick={() => setArtifactsPanelOpen(false)}
            className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
            aria-label="关闭面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-3 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {artifacts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm p-4 text-center">
              <div>
                <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>尚无产物生成</p>
                <p className="text-xs mt-1">请下达任务指令</p>
              </div>
            </div>
          ) : (
            <>
              {/* Artifact List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {artifacts.map((artifact) => {
                  const Icon = getArtifactIcon(artifact.type);
                  const isSelected = artifact.id === selectedArtifactId;

                  return (
                    <button
                      key={artifact.id}
                      onClick={() => setSelectedArtifactId(artifact.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg transition-colors',
                        isSelected
                          ? 'bg-primary-600/20 border border-primary-500/50'
                          : 'bg-neutral-700/50 hover:bg-neutral-700 border border-transparent'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{artifact.title}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {new Date(artifact.createdAt).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview Area */}
              {selectedArtifact && (
                <div className="h-48 border-t border-neutral-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">预览</span>
                    <div className="flex gap-1">
                      <button className="p-1 hover:bg-neutral-700 rounded text-neutral-400">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="h-32 bg-neutral-900 rounded-lg p-2 overflow-auto text-xs text-neutral-300">
                    {selectedArtifact.content || '无内容预览'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
```

需要添加 `useState` import。

- [ ] **Step 2: 更新 page.tsx 集成 ArtifactsPanel**

```tsx
// apps/web/src/app/page.tsx
// 在 return 中添加 ArtifactsPanel

import { ArtifactsPanel } from '@/components/layout/ArtifactsPanel';

// ...

return (
  <div className="flex h-screen bg-neutral-900 text-white">
    <Sidebar />
    <MainContent />
    <ArtifactsPanel />
  </div>
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/ArtifactsPanel.tsx apps/web/src/app/page.tsx
git commit -m "feat(ui): 添加 ArtifactsPanel 基础组件（空状态和产物列表）"
```

---

## Chunk 1 Checkpoint

Phase 1 完成。此时应该可以：
1. 服务器启动成功，数据库包含新表
2. 侧边栏显示新的导航入口（Claw/专家/自动化）
3. 点击导航可以切换主区域视图（显示占位内容）
4. 产物面板可以通过状态控制显示/隐藏

运行验证：
```bash
# 启动前端和后端
pnpm dev
```

---

## Chunk 2: Phase 2 - 产物面板完整实现

### Task 2.1: Artifacts API 路由

**Files:**
- Create: `apps/server/src/routes/artifacts.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: 创建 artifacts 路由**

```typescript
// apps/server/src/routes/artifacts.ts
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface ArtifactRow {
  id: string;
  conversation_id: string;
  task_id: string | null;
  type: string;
  title: string;
  content: string | null;
  file_path: string | null;
  mime_type: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

function rowToArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    taskId: row.task_id,
    type: row.type,
    title: row.title,
    content: row.content,
    filePath: row.file_path,
    mimeType: row.mime_type,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function artifactRoutes(fastify: FastifyInstance) {
  // List artifacts (optionally filtered by conversation)
  fastify.get<{
    Querystring: { conversationId?: string; taskId?: string };
  }>('/artifacts', async (request, reply) => {
    const { conversationId, taskId } = request.query;

    let sql = 'SELECT * FROM artifacts WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (conversationId) {
      sql += ' AND conversation_id = ?';
      params.push(conversationId);
    }
    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const rows = all<ArtifactRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToArtifact),
    };
  });

  // Get single artifact
  fastify.get<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    return { success: true, data: rowToArtifact(row) };
  });

  // Create artifact
  fastify.post<{
    Body: {
      conversationId: string;
      taskId?: string;
      type: string;
      title: string;
      content?: string;
      filePath?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    };
  }>('/artifacts', async (request, reply) => {
    const { conversationId, taskId, type, title, content, filePath, mimeType, metadata } = request.body;
    const id = `artifact_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO artifacts (id, conversation_id, task_id, type, title, content, file_path, mime_type, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        conversationId,
        taskId || null,
        type,
        title,
        content || null,
        filePath || null,
        mimeType || null,
        metadata ? JSON.stringify(metadata) : null,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        conversationId,
        taskId,
        type,
        title,
        content,
        filePath,
        mimeType,
        metadata,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update artifact
  fastify.put<{
    Params: { id: string };
    Body: {
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
    };
  }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, content, metadata } = request.body;

    const existing = get<ArtifactRow>('SELECT * FROM artifacts WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title : existing.title;
    const newContent = content !== undefined ? content : existing.content;
    const newMetadata = metadata !== undefined ? JSON.stringify(metadata) : existing.metadata;

    run(
      'UPDATE artifacts SET title = ?, content = ?, metadata = ?, updated_at = ? WHERE id = ?',
      [newTitle, newContent, newMetadata, now, id]
    );

    return {
      success: true,
      data: {
        ...rowToArtifact(existing),
        title: newTitle,
        content: newContent,
        metadata: metadata || (existing.metadata ? JSON.parse(existing.metadata) : null),
        updatedAt: now,
      },
    };
  });

  // Delete artifact
  fastify.delete<{ Params: { id: string } }>('/artifacts/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<ArtifactRow>('SELECT id FROM artifacts WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Artifact not found' });
    }

    run('DELETE FROM artifacts WHERE id = ?', [id]);
    return { success: true };
  });
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
// apps/server/src/app.ts
import { artifactRoutes } from './routes/artifacts.js';

// ... 在其他路由注册后添加
await fastify.register(artifactRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/artifacts.ts apps/server/src/app.ts
git commit -m "feat(api): 添加 Artifacts CRUD API 路由"
```

---

### Task 2.2: ChatPanel 添加产物按钮

**Files:**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: 添加产物按钮到 ChatHeader**

首先查看当前 ChatPanel 结构，添加产物按钮。

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/chat/ChatPanel.tsx
git commit -m "feat(chat): ChatPanel 添加产物面板开关按钮"
```

---

## Chunk 3: Phase 3 - 专家中心实现

### Task 3.1: Experts API 路由

**Files:**
- Create: `apps/server/src/routes/experts.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/db/index.ts` (添加默认专家种子数据)

- [ ] **Step 1: 创建 experts 路由**

```typescript
// apps/server/src/routes/experts.ts
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface ExpertRow {
  id: string;
  name: string;
  avatar: string | null;
  title: string;
  description: string | null;
  category: string;
  system_prompt: string;
  color: string | null;
  icon: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function rowToExpert(row: ExpertRow) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    title: row.title,
    description: row.description,
    category: row.category,
    systemPrompt: row.system_prompt,
    color: row.color,
    icon: row.icon,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function expertRoutes(fastify: FastifyInstance) {
  // List experts (optionally filtered by category)
  fastify.get<{ Querystring: { category?: string } }>('/experts', async (request, reply) => {
    const { category } = request.query;

    let sql = 'SELECT * FROM experts WHERE 1=1';
    const params: (string | number)[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_default DESC, name ASC';

    const rows = all<ExpertRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToExpert),
    };
  });

  // Get expert categories
  fastify.get('/experts/categories', async (request, reply) => {
    const rows = all<{ category: string; count: number }>(
      'SELECT category, COUNT(*) as count FROM experts GROUP BY category ORDER BY count DESC'
    );
    return { success: true, data: rows };
  });

  // Get single expert
  fastify.get<{ Params: { id: string } }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<ExpertRow>('SELECT * FROM experts WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    return { success: true, data: rowToExpert(row) };
  });

  // Create expert
  fastify.post<{
    Body: {
      name: string;
      title: string;
      category: string;
      systemPrompt: string;
      avatar?: string;
      description?: string;
      color?: string;
      icon?: string;
      isDefault?: boolean;
    };
  }>('/experts', async (request, reply) => {
    const { name, title, category, systemPrompt, avatar, description, color, icon, isDefault } = request.body;
    const id = `expert_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO experts (id, name, avatar, title, description, category, system_prompt, color, icon, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        avatar || null,
        title,
        description || null,
        category,
        systemPrompt,
        color || null,
        icon || null,
        isDefault ? 1 : 0,
        now,
        now,
      ]
    );

    return {
      success: true,
      data: {
        id,
        name,
        avatar,
        title,
        description,
        category,
        systemPrompt,
        color,
        icon,
        isDefault: isDefault || false,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update expert
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      title: string;
      category: string;
      systemPrompt: string;
      avatar: string;
      description: string;
      color: string;
      icon: string;
      isDefault: boolean;
    }>;
  }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const existing = get<ExpertRow>('SELECT * FROM experts WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    const now = new Date().toISOString();
    const updatedExpert = {
      name: updates.name ?? existing.name,
      title: updates.title ?? existing.title,
      category: updates.category ?? existing.category,
      systemPrompt: updates.systemPrompt ?? existing.system_prompt,
      avatar: updates.avatar ?? existing.avatar,
      description: updates.description ?? existing.description,
      color: updates.color ?? existing.color,
      icon: updates.icon ?? existing.icon,
      isDefault: updates.isDefault ?? existing.is_default === 1,
    };

    run(
      `UPDATE experts SET name = ?, title = ?, category = ?, system_prompt = ?, avatar = ?, description = ?, color = ?, icon = ?, is_default = ?, updated_at = ? WHERE id = ?`,
      [
        updatedExpert.name,
        updatedExpert.title,
        updatedExpert.category,
        updatedExpert.systemPrompt,
        updatedExpert.avatar,
        updatedExpert.description,
        updatedExpert.color,
        updatedExpert.icon,
        updatedExpert.isDefault ? 1 : 0,
        now,
        id,
      ]
    );

    return {
      success: true,
      data: { ...rowToExpert(existing), ...updatedExpert, updatedAt: now },
    };
  });

  // Delete expert
  fastify.delete<{ Params: { id: string } }>('/experts/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<ExpertRow>('SELECT id FROM experts WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Expert not found' });
    }

    run('DELETE FROM experts WHERE id = ?', [id]);
    return { success: true };
  });
}
```

- [ ] **Step 2: 添加默认专家种子数据**

在 `db/index.ts` 的 `initDatabase` 函数中添加：

```typescript
// 添加默认专家种子数据
function seedDefaultExperts(database: SqlJsDatabase): void {
  const count = database.exec("SELECT COUNT(*) FROM experts")[0]?.values?.[0]?.[0] as number;
  if (count > 0) return;

  const defaultExperts = [
    {
      id: 'expert_claw_default',
      name: 'Claw',
      title: '智能助手',
      category: '通用',
      systemPrompt: '你是一个有用的 AI 助手。',
      icon: 'Bot',
      isDefault: 1,
    },
    {
      id: 'expert_kai_content',
      name: 'Kai',
      title: '内容创作专家',
      category: '内容',
      systemPrompt: '你是一个内容创作专家，擅长创作引人入胜的文章、故事和营销文案。',
      icon: 'Pen',
    },
    {
      id: 'expert_phoebe_data',
      name: 'Phoebe',
      title: '数据分析专家',
      category: '数据',
      systemPrompt: '你是一个数据分析专家，擅长将复杂数据转化为清晰的洞察和报告。',
      icon: 'BarChart',
    },
  ];

  const now = new Date().toISOString();
  for (const expert of defaultExperts) {
    database.run(
      `INSERT INTO experts (id, name, title, category, system_prompt, icon, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expert.id, expert.name, expert.title, expert.category, expert.systemPrompt, expert.icon, expert.isDefault, now, now]
    );
  }
}
```

- [ ] **Step 3: 注册路由**

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/experts.ts apps/server/src/app.ts apps/server/src/db/index.ts
git commit -m "feat(api): 添加 Experts API 路由和默认专家种子数据"
```

---

### Task 3.2: ExpertCenter 视图组件

**Files:**
- Create: `apps/web/src/components/expert/ExpertCenter.tsx`
- Create: `apps/web/src/components/expert/ExpertCard.tsx`

- [ ] **Step 1: 创建 ExpertCard 组件**

- [ ] **Step 2: 创建 ExpertCenter 视图**

- [ ] **Step 3: 更新 MainContent 使用 ExpertCenter**

- [ ] **Step 4: Commit**

---

### Task 3.3: InputBar 角色选择器

**Files:**
- Create: `apps/web/src/components/chat/RoleSelector.tsx`
- Modify: `apps/web/src/components/chat/InputBar.tsx`

- [ ] **Step 1: 创建 RoleSelector 组件**

- [ ] **Step 2: 集成到 InputBar**

- [ ] **Step 3: Commit**

---

## Chunk 4: Phase 4 - 自动化中心实现

### Task 4.1: Automations API 路由

**Files:**
- Create: `apps/server/src/routes/automations.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: 创建 automations 路由**

- [ ] **Step 2: 注册路由**

- [ ] **Step 3: Commit**

---

### Task 4.2: AutomationCenter 视图组件

**Files:**
- Create: `apps/web/src/components/automation/AutomationCenter.tsx`
- Create: `apps/web/src/components/automation/AutomationItem.tsx`

- [ ] **Step 1: 创建 AutomationItem 组件**

- [ ] **Step 2: 创建 AutomationCenter 视图**

- [ ] **Step 3: 更新 MainContent 使用 AutomationCenter**

- [ ] **Step 4: Commit**

---

### Task 4.3: 调度服务（可选 - Phase 4.2）

**Files:**
- Create: `apps/server/src/services/scheduler.ts`

- [ ] **Step 1: 创建基础调度服务**

- [ ] **Step 2: Commit**

---

## Final Checkpoint

全部 Phase 完成后验证：

1. **视图切换**: 点击侧边栏 Claw/专家/自动化 可切换视图
2. **专家中心**: 显示专家列表，点击召唤可切换到聊天并选中该专家
3. **角色选择器**: 输入栏左侧可切换当前对话的专家角色
4. **产物面板**: 聊天时点击产物按钮可打开右侧面板
5. **自动化中心**: 显示已安排的自动化任务列表

---

## Notes

- 本计划按 Phase 分块，每个 Phase 产出可独立验证的功能
- 每个 Task 内的 Step 应该是 2-5 分钟可完成的原子操作
- 遵循 TDD 原则：先写测试，再实现功能
- 频繁提交，每个 Task 完成后提交一次
