# 会话产物面板设计文档

## 概述

将会话与产物面板关联，实现每个会话独立的文件管理。当 AI 在对话中生成文件（代码、图片、文档等）时，自动保存到会话对应的临时目录，并在产物面板中实时展示。

## 需求

1. 每个会话创建时，服务端自动创建对应的临时目录
2. AI 生成的所有类型文件（代码、图片、文档、配置等）自动保存到该目录
3. 产物面板按会话分组显示产物
4. 前端实时更新产物列表
5. 支持预览、下载、删除操作

## 架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   Backend API   │────▶│  File System    │
│  (Chat + Panel) │     │  (REST + WS)    │     │ (会话目录)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 目录结构

```
data/conversations/
  ├── conv_abc123/           # 会话 ID 作为目录名
  │   ├── main.py            # AI 生成的代码文件
  │   ├── output.png         # 生成的图片
  │   └── config.json        # 配置文件
  └── conv_def456/
      └── ...
```

## 后端实现

### 1. 文件存储服务

新建 `apps/server/src/services/artifactStorage.ts`:

```typescript
interface Artifact {
  id: string;
  conversationId: string;
  filename: string;
  type: 'code' | 'image' | 'document' | 'other';
  mimeType: string;
  size: number;
  path: string;
  createdAt: Date;
}

// 核心功能
- getConversationDir(conversationId): string  // 获取/创建会话目录
- saveArtifact(conversationId, filename, content): Artifact
- listArtifacts(conversationId): Artifact[]
- getArtifact(artifactId): Artifact + content
- deleteArtifact(artifactId): void
```

### 2. API 端点

新增 `apps/server/src/routes/artifacts.ts`:

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/conversations/:id/artifacts` | 获取会话产物列表 |
| GET | `/artifacts/:id` | 下载产物 |
| GET | `/artifacts/:id/preview` | 预览产物（用于图片、代码等） |
| DELETE | `/artifacts/:id` | 删除产物 |

### 3. 产物识别与保存

在 `apps/server/src/services/messageParser.ts` 或新建服务：

**识别规则：**
- 代码块（```language 格式）→ 保存为对应扩展名文件
- 图片 URL/dataURI → 下载/解码后保存为图片文件
- Markdown 中的文件链接 → 可选保存

```typescript
function extractArtifactsFromMessage(content: string): ExtractedArtifact[] {
  // 1. 提取代码块
  const codeBlocks = extractCodeBlocks(content);
  // 2. 提取图片
  const images = extractImages(content);
  // 3. 返回产物列表
  return [...codeBlocks, ...images];
}
```

### 4. WebSocket 事件

扩展现有 WebSocket 协议：

**服务端 → 客户端：**
```typescript
{
  type: 'artifact.created',
  payload: {
    conversationId: string;
    artifact: Artifact;
  }
}

{
  type: 'artifact.deleted',
  payload: {
    conversationId: string;
    artifactId: string;
  }
}
```

## 前端实现

### 1. chatStore 扩展

```typescript
interface ChatStore {
  // 现有...
  artifacts: Record<string, Artifact[]>;  // 按 conversationId 分组
  currentConversationArtifacts: Artifact[];

  // 新增方法
  loadArtifacts: (conversationId: string) => Promise<void>;
  addArtifact: (conversationId: string, artifact: Artifact) => void;
  removeArtifact: (artifactId: string) => void;
}
```

### 2. ArtifactsPanel 改动

- 切换会话时加载对应产物
- 监听 WebSocket `artifact.created` 事件
- 显示产物列表，支持：
  - 点击预览
  - 下载按钮
  - 删除按钮

### 3. 消息中的产物指示

在消息气泡中显示产物引用：
- 代码块右上角显示"已保存"标记
- 点击可跳转到产物面板

## 数据流

```
1. 用户发送消息
       ↓
2. AI 回复包含代码块/图片
       ↓
3. 后端 extractArtifactsFromMessage() 识别产物
       ↓
4. artifactStorage.saveArtifact() 保存到文件系统
       ↓
5. WebSocket 发送 artifact.created 事件
       ↓
6. 前端收到事件，更新产物面板
       ↓
7. 用户在面板中查看/下载文件
```

## 文件类型映射

| 内容类型 | 文件扩展名 | MIME Type |
|----------|-----------|-----------|
| JavaScript | .js | application/javascript |
| TypeScript | .ts | application/typescript |
| Python | .py | text/x-python |
| Markdown | .md | text/markdown |
| JSON | .json | application/json |
| PNG | .png | image/png |
| JPEG | .jpg, .jpeg | image/jpeg |
| SVG | .svg | image/svg+xml |
| 其他代码 | 根据语言标识 | text/plain |

## 清理策略

- 会话删除时，自动删除对应的产物目录
- 可选：定期清理长时间未访问的会话目录

## 任务分解

1. **后端 - 文件存储服务** - 创建 artifactStorage.ts
2. **后端 - API 端点** - 创建 artifacts 路由
3. **后端 - 产物识别** - 实现消息解析和自动保存
4. **后端 - WebSocket** - 添加产物事件推送
5. **前端 - Store 扩展** - 修改 chatStore 支持分组存储
6. **前端 - WebSocket 处理** - 处理产物事件
7. **前端 - 面板改造** - ArtifactsPanel 支持会话切换
8. **前端 - 消息增强** - 消息中显示产物指示
9. **集成测试** - 端到端测试产物流程
