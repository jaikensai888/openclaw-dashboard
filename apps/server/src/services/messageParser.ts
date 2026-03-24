/**
 * Message Parser Service
 * Parses task protocol markers from agent messages
 */

import { TASK_PATTERNS, type TaskType, type MessageType } from '@openclaw-dashboard/shared';

export interface TaskInfo {
  type?: TaskType;
  title?: string;
  status?: 'completed' | 'failed';
  progress?: number;
  message?: string;
  errorMessage?: string;
}

export interface ParseResult {
  messageType: MessageType;
  taskInfo?: TaskInfo;
  cleanContent: string;
}

class MessageParser {
  /**
   * Parse message content and extract task information
   */
  parse(content: string): ParseResult {
    const lines = content.split('\n');
    const result: ParseResult = {
      messageType: 'text',
      cleanContent: '',
    };

    for (const line of lines) {
      // Check for task start
      const startMatch = line.match(TASK_PATTERNS.START);
      if (startMatch) {
        result.messageType = 'task_start';
        result.taskInfo = {
          type: startMatch[1] as TaskType,
          title: startMatch[2],
        };
        continue;
      }

      // Check for progress update
      const progressMatch = line.match(TASK_PATTERNS.PROGRESS);
      if (progressMatch) {
        result.messageType = 'task_update';
        result.taskInfo = {
          progress: parseInt(progressMatch[1], 10),
          message: progressMatch[2] || undefined,
        };
        continue;
      }

      // Check for task done
      if (TASK_PATTERNS.DONE.test(line)) {
        result.messageType = 'task_end';
        result.taskInfo = { status: 'completed' };
        continue;
      }

      // Check for task failed
      const failedMatch = line.match(TASK_PATTERNS.FAILED);
      if (failedMatch) {
        result.messageType = 'task_end';
        result.taskInfo = {
          status: 'failed',
          errorMessage: failedMatch[1],
        };
        continue;
      }

      // Regular content
      result.cleanContent += line + '\n';
    }

    // Trim trailing whitespace
    result.cleanContent = result.cleanContent.trimEnd();

    return result;
  }

  /**
   * Check if content contains any task markers
   */
  hasTaskMarkers(content: string): boolean {
    return (
      TASK_PATTERNS.START.test(content) ||
      TASK_PATTERNS.PROGRESS.test(content) ||
      TASK_PATTERNS.DONE.test(content) ||
      TASK_PATTERNS.FAILED.test(content)
    );
  }
}

// Singleton instance
export const messageParser = new MessageParser();

// ============ 产物提取相关 ============

export interface ExtractedArtifact {
  type: 'code' | 'image' | 'document';
  language?: string;
  filename?: string;
  content: string;
  isReference?: boolean;  // 标记是否为引用（无实际内容）
}

/**
 * 获取文件扩展名
 */
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
 * 从消息内容中提取图片（dataURI）
 */
export function extractImages(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];
  const imageRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/gi;

  let match;
  let imageIndex = 1;
  while ((match = imageRegex.exec(content)) !== null) {
    const alt = match[1];
    const extension = match[3] || 'png';
    const base64Data = match[4];
    const filename = alt ? `${alt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30)}.${extension}` : `image_${imageIndex}.${extension}`;

    artifacts.push({
      type: 'image',
      filename,
      content: base64Data, // 保持 base64 格式
    });
    imageIndex++;
  }

  return artifacts;
}

/**
 * 从消息内容中提取文件保存引用
 * 检测 AI 回复中声称保存的文件，如 "已保存到 `filename`"
 */
export function extractFileReferences(content: string): ExtractedArtifact[] {
  const artifacts: ExtractedArtifact[] = [];

  // 匹配各种文件保存声明的模式
  const patterns = [
    // 中文: 已保存到 `filename` 或 保存到 `filename`
    /(?:已)?保存到?\s*[`「『]([^`」』]+\.[a-zA-Z0-9]+)[`」』]/g,
    // 英文: Saved to `filename` or saved as `filename`
    /saved\s+(?:to|as)\s+[`"']([^`"']+\.[a-zA-Z0-9]+)[`"']/gi,
    // 通用: 文件 `filename` 已保存
    /文件\s*[`「『]([^`」』]+\.[a-zA-Z0-9]+)[`」』]\s*已保存/g,
    // 通用: `filename` saved
    /[`"']([^`"']+\.[a-zA-Z0-9]+)[`"']\s*(?:已)?保存/g,
  ];

  const seenFiles = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const filename = match[1];

      // 避免重复
      if (seenFiles.has(filename)) continue;
      seenFiles.add(filename);

      // 根据文件扩展名确定类型
      const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
      let artifactType: 'code' | 'document' = 'document';

      const codeExtensions = ['js', 'ts', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'html', 'css', 'json', 'yaml', 'yml', 'sql', 'sh'];
      if (codeExtensions.includes(ext)) {
        artifactType = 'code';
      }

      artifacts.push({
        type: artifactType,
        filename,
        content: `[文件引用: ${filename}]`,  // 占位符内容
        isReference: true,
      });
    }
  }

  return artifacts;
}

/**
 * 从消息内容中提取所有产物
 * 只提取有实际内容的产物（代码块和图片）
 */
export function extractArtifactsFromMessage(content: string): ExtractedArtifact[] {
  const codeBlocks = extractCodeBlocks(content);
  const images = extractImages(content);
  return [...codeBlocks, ...images];
}

// ============ 文件保存标记解析 ============

/**
 * 文件保存标记正则
 */
const FILE_SAVED_PATTERN = /\[FILE_SAVED:\s*([^\]]+)\]/g;

/**
 * 解析文件保存标记
 * 返回保存的文件路径列表和清理后的内容
 */
export function parseFileSavedMarkers(content: string): {
  filePaths: string[];
  cleanContent: string;
} {
  const filePaths: string[] = [];
  let match;

  while ((match = FILE_SAVED_PATTERN.exec(content)) !== null) {
    const filePath = match[1].trim();
    if (filePath) {
      filePaths.push(filePath);
    }
  }

  // 移除标记，清理内容
  const cleanContent = content.replace(FILE_SAVED_PATTERN, '').trim();

  return { filePaths, cleanContent };
}
