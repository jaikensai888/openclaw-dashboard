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
  type: 'code' | 'image';
  language?: string;
  filename?: string;
  content: string;
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
 * 从消息内容中提取所有产物
 */
export function extractArtifactsFromMessage(content: string): ExtractedArtifact[] {
  const codeBlocks = extractCodeBlocks(content);
  const images = extractImages(content);
  return [...codeBlocks, ...images];
}
