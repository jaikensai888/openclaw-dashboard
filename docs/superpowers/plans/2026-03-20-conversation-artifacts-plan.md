# 会话产物面板实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现会话与产物面板的关联，每个会话独立管理产物文件，AI 生成的代码/图片自动保存并实时展示。

**Architecture:** 后端使用文件系统存储会话产物（`data/conversations/{id}/`），增强 messageParser 识别 AI 回复中的代码块和图片，通过 WebSocket 实时推送产物事件，前端按会话分组显示产物。

**Tech Stack:** Fastify, SQLite, WebSocket, Next.js, Zustand

---

## File Structure

```
apps/server/src/
├── services/
│   ├── artifactStorage.ts     # 新建 - 文件存储服务
│   └── messageParser.ts       # 修改 - 添加产物提取
├── routes/
│   ├── artifacts.ts           # 修改 - 添加文件下载/预览
│   └── websocket.ts           # 修改 - 添加产物事件
└── db/
    └── index.ts               # 可能需要更新 schema

apps/web/src/
├── stores/
│   └── chatStore.ts           # 修改 - 产物按会话分组
├── hooks/
│   └── useWebSocket.ts        # 修改 - 处理产物事件
└── components/
    └── layout/
        └── ArtifactsPanel.tsx # 修改 - 显示当前会话产物
```

---

## Chunk 1: 后端文件存储服务

### Task 1: 创建 artifactStorage 服务

**Files:**
- Create: `apps/server/src/services/artifactStorage.ts`

- [ ] **Step 1: 创建 artifactStorage.ts 基础结构**

```typescript
/**
 * Artifact Storage Service
 * 管理会话产物的文件存储
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

// 基础存储路径
const CONVERSATIONS_DIR = path.join(process.cwd(), 'data', 'conversations');

// 文件类型映射
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  go: 'go',
  rust: 'rs',
  cpp: 'cpp',
  c: 'c',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'md',
  yaml: 'yaml',
  sql: 'sql',
  shell: 'sh',
  bash: 'sh',
};

const MIME_TYPES: Record<string, string> = {
  js: 'application/javascript',
  ts: 'application/typescript',
  py: 'text/x-python',
  html: 'text/html',
  css: 'text/css',
  json: 'application/json',
  md: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

export interface Artifact {
  id: string;
  conversationId: string;
  filename: string;
  type: 'code' | 'image' | 'document' | 'other';
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

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

/**
 * 确保 conversation 目录存在
 */
export function getConversationDir(conversationId: string): string {
  const dir = path.join(CONVERSATIONS_DIR, conversationId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 根据语言获取文件扩展名
 */
export function getExtension(language: string): string {
  return LANGUAGE_EXTENSIONS[language.toLowerCase()] || 'txt';
}

/**
 * 获取 MIME 类型
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'text/plain';
}

/**
 * 保存产物到文件系统并记录到数据库
 */
export function saveArtifact(
  conversationId: string,
  filename: string,
  content: string | Buffer,
  type: 'code' | 'image' | 'document' | 'other' = 'code'
): Artifact {
  const id = `artifact_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const dir = getConversationDir(conversationId);
  const filePath = path.join(dir, filename);

  // 写入文件
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  fs.writeFileSync(filePath, buffer);

  // 获取文件信息
  const stats = fs.statSync(filePath);
  const mimeType = getMimeType(filename);

  // 保存到数据库
  const now = new Date().toISOString();
  run(
    `INSERT INTO artifacts (id, conversation_id, type, title, content, file_path, mime_type, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      conversationId,
      type,
      filename,
      type === 'code' ? (typeof content === 'string' ? content : null) : null,
      filePath,
      mimeType,
      JSON.stringify({ size: stats.size }),
      now,
      now,
    ]
  );

  return {
    id,
    conversationId,
    filename,
    type,
    mimeType,
    size: stats.size,
    path: filePath,
    createdAt: new Date(now),
  };
}

/**
 * 获取会话的所有产物
 */
export function listArtifacts(conversationId: string): Artifact[] {
  const rows = all<ArtifactRow>(
    'SELECT * FROM artifacts WHERE conversation_id = ? ORDER BY created_at DESC',
    [conversationId]
  );

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.title,
    type: row.type as 'code' | 'image' | 'document' | 'other',
    mimeType: row.mime_type || 'text/plain',
    size: row.metadata ? JSON.parse(row.metadata).size || 0 : 0,
    path: row.file_path || '',
    createdAt: new Date(row.created_at),
  }));
}

/**
 * 获取单个产物
 */
export function getArtifact(artifactId: string): (Artifact & { content?: string }) | null {
  const row = get<ArtifactRow>(
    'SELECT * FROM artifacts WHERE id = ?',
    [artifactId]
  );

  if (!row) return null;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.title,
    type: row.type as 'code' | 'image' | 'document' | 'other',
    mimeType: row.mime_type || 'text/plain',
    size: row.metadata ? JSON.parse(row.metadata).size || 0 : 0,
    path: row.file_path || '',
    content: row.content || undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * 读取产物文件内容
 */
export function readArtifactContent(artifactId: string): Buffer | null {
  const artifact = getArtifact(artifactId);
  if (!artifact || !artifact.path) return null;

  try {
    return fs.readFileSync(artifact.path);
  } catch {
    return null;
  }
}

/**
 * 删除产物
 */
export function deleteArtifact(artifactId: string): boolean {
  const artifact = getArtifact(artifactId);
  if (!artifact) return false;

  // 删除文件
  if (artifact.path && fs.existsSync(artifact.path)) {
    fs.unlinkSync(artifact.path);
  }

  // 删除数据库记录
  run('DELETE FROM artifacts WHERE id = ?', [artifactId]);
  return true;
}

/**
 * 删除会话的所有产物
 */
export function deleteConversationArtifacts(conversationId: string): void {
  const dir = path.join(CONVERSATIONS_DIR, conversationId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  run('DELETE FROM artifacts WHERE conversation_id = ?', [conversationId]);
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/artifactStorage.ts
git commit -m "feat(server): 添加 artifactStorage 文件存储服务"
```

---

## Chunk 2: 消息解析器增强

### Task 2: 添加产物提取功能

**Files:**
- Modify: `apps/server/src/services/messageParser.ts`

- [ ] **Step 1: 添加产物提取接口和代码块提取函数**

在文件末尾 `messageParser` 导出之前添加：

```typescript
// 产物提取相关
export interface ExtractedArtifact {
  type: 'code' | 'image';
  language?: string;
  filename?: string;
  content: string;
}

/**
 * 从消息内容中提取代码块
 */
export function extractCodeBlocks(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];
  const codeBlockRegex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;

  let match;
  let codeIndex = 1;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const language = match[1] || 'text';
    const filename = match[2]?.trim() || `code_${codeIndex}.${getExtension(language)}`;
    const code = match[3];

    // 只保存有意义的代码块（超过 3 行或有明显代码特征）
    const lines = code.trim().split('\n');
    if (lines.length >= 3 || code.includes('function') || code.includes('class ') || code.includes('import ')) {
      artifacts.push({
        type: 'code',
        language,
        filename,
        content: code,
      });
      codeIndex++;
    }
  }

  return artifacts;
}

/**
 * 从消息内容中提取图片（dataURI 或 URL）
 */
export function extractImages(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];
  const imageRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+)|([^)]+\.(png|jpg|jpeg|svg|gif|webp)))\)/gi;

  let match;
  let imageIndex = 1;
  while ((match = imageRegex.exec(content)) !== null) {
    const alt = match[1];
    const imageData = match[2];
    const extension = match[3] || match[6] || 'png';
    const filename = alt ? `${alt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${extension}` : `image_${imageIndex}.${extension}`;

    if (imageData.startsWith('data:')) {
      // Base64 编码的图片
      const base64Data = imageData.split(',')[1];
      artifacts.push({
        type: 'image',
        filename,
        content: base64Data, // 保持 base64 格式
      });
    } else {
      // URL 图片 - 暂不处理，可以后续扩展下载功能
    }
    imageIndex++;
  }

  return artifacts;
}

/**
 * 从消息内容中提取所有产物
 */
export function extractArtifactsFromMessage(content: string): ExtractedArtifact[] {
  const codeBlocks = extractCodeBlocks(content);
  const images = extractImages(content);
  return [...codeBlocks, ...images];
}

// 辅助函数 - 获取文件扩展名
function getExtension(language: string): string {
  const mapping: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    go: 'go',
    rust: 'rs',
    cpp: 'cpp',
    c: 'c',
    html: 'html',
    css: 'css',
    json: 'json',
    markdown: 'md',
    yaml: 'yml',
    sql: 'sql',
    shell: 'sh',
    bash: 'sh',
  };
  return mapping[language.toLowerCase()] || 'txt';
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/services/messageParser.ts
git commit -m "feat(server): 添加消息产物提取功能"
```

---

## Chunk 3: WebSocket 产物事件处理

### Task 3: 更新 WebSocket 处理产物事件

**Files:**
- Modify: `apps/server/src/routes/websocket.ts`

- [ ] **Step 1: 导入 artifactStorage 并添加产物处理**

在文件顶部添加导入：

```typescript
import {
  saveArtifact,
  listArtifacts,
  deleteConversationArtifacts,
  type Artifact,
} from '../services/artifactStorage.js';
import {
  extractArtifactsFromMessage,
  type ExtractedArtifact,
} from '../services/messageParser.js';
```

- [ ] **Step 2: 在 handleAgentMessage 中添加产物提取**

找到 `handleAgentMessage` 函数，在保存消息后添加产物提取逻辑：

```typescript
// 在 handleAgentMessage 函数末尾，run(`UPDATE conversations...`) 之后添加:

  // 提取并保存产物
  if (content) {
    const extracted = extractArtifactsFromMessage(content);
    for (const item of extracted) {
      try {
        const artifact = saveArtifact(
          conversationId,
          item.filename || `artifact_${Date.now()}`,
          item.content,
          item.type
        );

        // 广播产物创建事件
        broadcast('artifact.created', {
          conversationId,
          artifact,
        });
      } catch (error) {
        console.error('[WS] Failed to save artifact:', error);
      }
    }
  }
```

- [ ] **Step 3: 在 handleDeleteConversation 中清理产物**

找到 `handleDeleteConversation` 函数，在删除会话前添加：

```typescript
async function handleDeleteConversation(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;

  const existing = get<{ id: string }>(`SELECT id FROM conversations WHERE id = ?`, [conversationId]);
  if (!existing) {
    sendError(ws, 'NOT_FOUND', 'Conversation not found');
    return;
  }

  // 删除产物文件和记录
  deleteConversationArtifacts(conversationId);

  // 删除消息 first (foreign key constraint)
  run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);
  // 删除 conversation
  run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);

  broadcast('conversation.deleted', { id: conversationId });
}
```

- [ ] **Step 4: 添加加载产物列表的处理器**

在 `handleClientMessage` 的 switch 中添加新 case：

```typescript
    case 'artifacts.load':
      handleLoadArtifacts(ws, payload as { conversationId: string });
      break;
```

然后添加新函数：

```typescript
async function handleLoadArtifacts(ws: WebSocket, payload: { conversationId: string }) {
  const { conversationId } = payload;
  const artifacts = listArtifacts(conversationId);
  send(ws, 'artifacts.list', {
    conversationId,
    artifacts,
  });
}
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/websocket.ts
git commit -m "feat(server): WebSocket 添加产物事件处理"
```

---

## Chunk 4: 前端 chatStore 扩展

### Task 4: 修改 chatStore 支持产物分组

**Files:**
- Modify: `apps/web/src/stores/chatStore.ts`

- [ ] **Step 1: 修改 artifacts 相关状态**

找到 `artifacts` 相关定义，修改为按 conversationId 分组：

```typescript
// 修改 artifacts 类型
artifacts: Record<string, Artifact[]>;  // 按 conversationId 分组

// 添加 getter
currentConversationArtifacts: Artifact[];

// 修改方法签名
loadArtifacts: (conversationId: string) => void;
addArtifact: (conversationId: string, artifact: Artifact) => void;
removeArtifact: (artifactId: string) => void;
```

- [ ] **Step 2: 更新 store 初始值和实现**

```typescript
// 初始值
artifacts: {},

// 在 computed 部分
get currentConversationArtifacts() {
  const convId = get().currentConversationId;
  if (!convId) return [];
  return get().artifacts[convId] || [];
},

// 方法实现
loadArtifacts: (conversationId, artifacts) => set((state) => ({
  artifacts: {
    ...state.artifacts,
    [conversationId]: artifacts,
  },
})),

addArtifact: (conversationId, artifact) => set((state) => ({
  artifacts: {
    ...state.artifacts,
    [conversationId]: [...(state.artifacts[conversationId] || []), artifact],
  },
})),

removeArtifact: (artifactId) => set((state) => {
  const newArtifacts = { ...state.artifacts };
  for (const convId of Object.keys(newArtifacts)) {
    newArtifacts[convId] = newArtifacts[convId].filter(a => a.id !== artifactId);
  }
  return { artifacts: newArtifacts };
}),
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/stores/chatStore.ts
git commit -m "feat(web): chatStore 支持产物按会话分组"
```

---

## Chunk 5: 前端 WebSocket 处理

### Task 5: 更新 useWebSocket 处理产物事件

**Files:**
- Modify: `apps/web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 在 handleMessage 中添加产物事件处理**

在 `handleMessage` 函数的 switch 中添加：

```typescript
    case 'artifact.created':
      {
        const { conversationId, artifact } = payload as {
          conversationId: string;
          artifact: Artifact;
        };
        store.addArtifact(conversationId, artifact);
      }
      break;

    case 'artifact.deleted':
      {
        const { artifactId } = payload as { artifactId: string };
        store.removeArtifact(artifactId);
      }
      break;

    case 'artifacts.list':
      {
        const { conversationId, artifacts } = payload as {
          conversationId: string;
          artifacts: Artifact[];
        };
        store.loadArtifacts(conversationId, artifacts);
      }
      break;
```

- [ ] **Step 2: 添加 loadArtifacts 方法到返回值**

在 `useWebSocket` 返回值中添加：

```typescript
const loadArtifacts = useCallback((conversationId: string) => {
  send('artifacts.load', { conversationId });
}, []);

return {
  // ...existing
  loadArtifacts,
};
```

- [ ] **Step 3: 在切换会话时加载产物**

在 `switchConversation` 函数中添加产物加载：

```typescript
const switchConversation = useCallback(
  (conversationId: string) => {
    send('conversation.switch', { conversationId });
    // 加载该会话的产物
    send('artifacts.load', { conversationId });
  },
  []
);
```

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useWebSocket.ts
git commit -m "feat(web): WebSocket 处理产物事件"
```

---

## Chunk 6: 前端 ArtifactsPanel 改造

### Task 6: 更新 ArtifactsPanel 显示当前会话产物

**Files:**
- Modify: `apps/web/src/components/layout/ArtifactsPanel.tsx`

- [ ] **Step 1: 修改产物获取逻辑**

```typescript
const {
  artifactsPanelOpen,
  setArtifactsPanelOpen,
  currentConversationArtifacts,  // 使用当前会话产物
  selectedArtifactId,
  setSelectedArtifactId,
  currentConversationId,  // 获取当前会话 ID
} = useChatStore();

// 使用当前会话的产物
const artifacts = currentConversationArtifacts;
```

- [ ] **Step 2: 添加下载和预览功能**

```typescript
const handleDownload = async (artifact: Artifact) => {
  const response = await fetch(`${API_BASE_URL}/artifacts/${artifact.id}`);
  const data = await response.json();
  if (data.success) {
    const blob = new Blob([data.data.content], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const handlePreview = (artifact: Artifact) => {
  setSelectedArtifactId(artifact.id);
};
```

- [ ] **Step 3: 显示当前会话指示**

在面板标题处添加：

```typescript
<div className="flex items-center justify-between p-4 border-b border-neutral-700">
  <div>
    <h2 className="text-sm font-medium text-neutral-200">产物面板</h2>
    {currentConversationId && (
      <p className="text-xs text-neutral-500 mt-0.5">当前会话</p>
    )}
  </div>
  // ...close button
</div>
```

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/ArtifactsPanel.tsx
git commit -m "feat(web): ArtifactsPanel 显示当前会话产物"
```

---

## Chunk 7: 后端 API 产物下载/预览

### Task 7: 增强 artifacts 路由

**Files:**
- Modify: `apps/server/src/routes/artifacts.ts`

- [ ] **Step 1: 添加文件下载端点**

在现有路由后添加：

```typescript
// 下载产物文件
fastify.get<{ Params: { id: string } }>('/artifacts/:id/download', async (request, reply) => {
  const { id } = request.params;
  const artifact = getArtifact(id);

  if (!artifact) {
    return reply.status(404).send({ success: false, error: 'Artifact not found' });
  }

  const content = readArtifactContent(id);
  if (!content) {
    return reply.status(404).send({ success: false, error: 'File not found' });
  }

  return reply
    .header('Content-Type', artifact.mimeType)
    .header('Content-Disposition', `attachment; filename="${artifact.filename}"`)
    .send(content);
});

// 预览产物（用于图片等）
fastify.get<{ Params: { id: string } }>('/artifacts/:id/preview', async (request, reply) => {
  const { id } = request.params;
  const artifact = getArtifact(id);

  if (!artifact) {
    return reply.status(404).send({ success: false, error: 'Artifact not found' });
  }

  const content = readArtifactContent(id);
  if (!content) {
    return reply.status(404).send({ success: false, error: 'File not found' });
  }

  return reply
    .header('Content-Type', artifact.mimeType)
    .header('Cache-Control', 'public, max-age=3600')
    .send(content);
});
```

- [ ] **Step 2: 添加导入**

```typescript
import {
  getArtifact,
  readArtifactContent,
  listArtifacts,
} from '../services/artifactStorage.js';
```

- [ ] **Step 3: 修改列表端点使用 artifactStorage**

更新 GET /artifacts 端点，当有 conversationId 时使用 artifactStorage：

```typescript
fastify.get<{
  Querystring: { conversationId?: string; taskId?: string };
}>('/artifacts', async (request, reply) => {
  const { conversationId } = request.query;

  if (conversationId) {
    // 使用新的存储服务
    const artifacts = listArtifacts(conversationId);
    return { success: true, data: artifacts };
  }

  // 保留原有的数据库查询逻辑...
});
```

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd apps/server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/artifacts.ts
git commit -m "feat(server): 添加产物下载/预览 API"
```

---

## 验证清单

- [ ] 新建会话时，产物目录自动创建
- [ ] AI 回复包含代码块时，自动保存为产物
- [ ] 产物面板显示当前会话的产物
- [ ] 切换会话时，产物列表更新
- [ ] 点击产物可预览/下载
- [ ] 删除会话时，产物文件被清理
