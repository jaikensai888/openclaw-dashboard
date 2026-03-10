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
