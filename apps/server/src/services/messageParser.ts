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
