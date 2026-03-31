-- Openclaw Dashboard Database Schema
-- SQLite

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,              -- UUID, format: conv_xxx
    title TEXT,                       -- Conversation title
    pinned INTEGER DEFAULT 0,         -- 是否置顶 (0: 否, 1: 是)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,              -- UUID, format: msg_xxx
    conversation_id TEXT NOT NULL,    -- Belongs to conversation
    role TEXT NOT NULL,               -- 'user' | 'assistant'
    content TEXT NOT NULL,            -- Message content
    message_type TEXT DEFAULT 'text', -- 'text' | 'task_start' | 'task_update' | 'task_end'
    task_id TEXT,                     -- Associated task ID
    metadata TEXT,                    -- JSON metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,              -- UUID, format: task_xxx
    conversation_id TEXT NOT NULL,    -- Belongs to conversation
    type TEXT NOT NULL,               -- Task type: research, code, file, command, custom
    title TEXT,                       -- Task title
    status TEXT DEFAULT 'pending',    -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress INTEGER DEFAULT 0,       -- Progress 0-100
    progress_message TEXT,            -- Current progress message
    error_message TEXT,               -- Error message if failed
    started_at DATETIME,              -- Start time
    completed_at DATETIME,            -- Completion time
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Task outputs table
CREATE TABLE IF NOT EXISTS task_outputs (
    id TEXT PRIMARY KEY,              -- UUID
    task_id TEXT NOT NULL,            -- Belongs to task
    sequence INTEGER DEFAULT 0,       -- Output order
    type TEXT NOT NULL,               -- 'text' | 'code' | 'image' | 'file' | 'link'
    content TEXT,                     -- Output content
    metadata TEXT,                    -- JSON metadata (language, filename, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_conversation ON tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_outputs_task ON task_outputs(task_id);

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

-- Rules table (会话初始化规则)
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

-- Rules indexes
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);

-- Remote servers table (远程服务器配置)
CREATE TABLE IF NOT EXISTS remote_servers (
    id TEXT PRIMARY KEY,              -- UUID, format: server_xxx
    name TEXT NOT NULL,               -- 服务器名称
    host TEXT NOT NULL,               -- 服务器地址
    port INTEGER DEFAULT 22,          -- SSH 端口
    username TEXT NOT NULL,           -- SSH 用户名
    private_key_path TEXT,            -- SSH 私钥路径
    remote_port INTEGER DEFAULT 3001, -- remote-server 端口
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
