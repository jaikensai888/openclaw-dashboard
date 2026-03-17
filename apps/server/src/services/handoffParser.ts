/**
 * Handoff Protocol Parser
 *
 * Parses HANDOFF markers from agent output to enable agent-to-agent handoff.
 *
 * Format: HANDOFF:<agent_id>[:<reason>]
 * Example: HANDOFF:coder:需要代码实现
 */

import { HANDOFF_PATTERN, type HandoffInstruction, type VirtualAgentId } from '@openclaw-dashboard/shared';
import { isValidAgentId, getVirtualAgent } from './virtualAgents.js';

export interface ParsedAgentOutput {
  /** Content with handoff markers removed */
  cleanContent: string;
  /** Handoff instruction if present */
  handoff?: HandoffInstruction;
}

/**
 * Parse handoff instruction from agent output
 */
export function parseHandoff(
  content: string,
  fromAgentId: VirtualAgentId
): ParsedAgentOutput {
  const match = content.match(HANDOFF_PATTERN);

  if (!match) {
    return { cleanContent: content };
  }

  const toAgentId = match[1] as VirtualAgentId;
  const reason = match[2]?.trim() || undefined;

  // Validate target agent exists
  if (!isValidAgentId(toAgentId)) {
    console.warn(`[Handoff] Invalid target agent: ${toAgentId}`);
    return { cleanContent: content };
  }

  // Prevent self-handoff
  if (toAgentId === fromAgentId) {
    console.warn(`[Handoff] Cannot handoff to self: ${fromAgentId}`);
    return { cleanContent: content };
  }

  // Remove the handoff marker from content
  const cleanContent = content.replace(HANDOFF_PATTERN, '').trim();

  return {
    cleanContent,
    handoff: {
      fromAgentId,
      toAgentId,
      reason,
    },
  };
}

/**
 * Build context string for handoff
 */
export function buildHandoffContext(
  fromAgent: { displayName: string },
  originalQuestion: string,
  currentConclusion: string,
  reason?: string
): string {
  return `[上一任 Agent: ${fromAgent.displayName}]
${reason ? `移交原因: ${reason}\n` : ''}
用户原始问题:
${originalQuestion}

当前分析结论:
${currentConclusion}

请继续处理用户的请求。`;
}

/**
 * Maximum handoff depth to prevent infinite loops
 */
export const MAX_HANDOFF_DEPTH = 3;

/**
 * Check if handoff depth is within limits
 */
export function isHandoffDepthValid(depth: number): boolean {
  return depth < MAX_HANDOFF_DEPTH;
}
