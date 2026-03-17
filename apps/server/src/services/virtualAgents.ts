/**
 * Virtual Agent Registry
 *
 * Manages virtual agent definitions - each agent has its own role, prompt, and capabilities.
 */

import type { VirtualAgentId, ActiveAgentInfo } from '@openclaw-dashboard/shared';

export interface VirtualAgent {
  /** Unique identifier for the agent */
  id: VirtualAgentId;
  /** Display name shown in UI */
  displayName: string;
  /** Brief description of the agent's role */
  description?: string;
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** Model to use (optional, uses default if not specified) */
  model?: string;
  /** UI display color */
  color?: string;
  /** UI icon name */
  icon?: string;
  /** Whether this agent can be a handoff target */
  allowHandoff?: boolean;
  /** Tags for categorization (e.g., 'research', 'code') */
  tags?: string[];
}

/**
 * Built-in virtual agents registry
 */
export const virtualAgentsRegistry: VirtualAgent[] = [
  {
    id: 'default',
    displayName: '通用助手',
    description: '通用 AI 助手，可以处理各种任务',
    systemPrompt: `你是一个有帮助的 AI 助手。请用中文回复用户的问题。
- 回答要准确、简洁
- 如果不确定，请诚实说明
- 必要时提供代码示例`,
    color: '#0ea5e9', // sky-500
    icon: 'bot',
    allowHandoff: true,
    tags: ['general'],
  },
  {
    id: 'researcher',
    displayName: '调研专家',
    description: '专注于信息调研和分析',
    systemPrompt: `你是一个专业的调研助手。你的任务是：
- 深入分析问题，收集相关信息
- 提供结构化的调研报告
- 引用来源和依据
- 如果需要代码实现，请使用 HANDOFF:coder:需要代码实现 来移交给代码专家

输出格式：
1. 问题分析
2. 调研发现
3. 结论和建议`,
    color: '#22c55e', // green-500
    icon: 'search',
    allowHandoff: true,
    tags: ['research', 'analysis'],
  },
  {
    id: 'coder',
    displayName: '代码专家',
    description: '专注于代码编写和技术实现',
    systemPrompt: `你是一个专业的代码助手。你的任务是：
- 编写高质量、可维护的代码
- 遵循最佳实践和设计模式
- 添加必要的注释和文档
- 考虑边界情况和错误处理

代码规范：
- 使用 TypeScript/JavaScript 为主
- 遵循项目现有的代码风格
- 必要时解释复杂逻辑`,
    color: '#f59e0b', // amber-500
    icon: 'code',
    model: 'claude-sonnet-4-6',
    allowHandoff: true,
    tags: ['code', 'development'],
  },
];

/**
 * Get a virtual agent by ID
 */
export function getVirtualAgent(id: VirtualAgentId): VirtualAgent | undefined {
  return virtualAgentsRegistry.find(agent => agent.id === id);
}

/**
 * Get the default virtual agent
 */
export function getDefaultVirtualAgent(): VirtualAgent {
  return virtualAgentsRegistry[0];
}

/**
 * List all available virtual agents
 */
export function listVirtualAgents(): VirtualAgent[] {
  return [...virtualAgentsRegistry];
}

/**
 * List agents that can be handoff targets
 */
export function listHandoffTargets(): VirtualAgent[] {
  return virtualAgentsRegistry.filter(agent => agent.allowHandoff !== false);
}

/**
 * Convert VirtualAgent to ActiveAgentInfo for API responses
 */
export function toActiveAgentInfo(agent: VirtualAgent): ActiveAgentInfo {
  return {
    virtualAgentId: agent.id,
    displayName: agent.displayName,
    description: agent.description,
    color: agent.color,
    icon: agent.icon,
  };
}

/**
 * Check if an agent ID is valid
 */
export function isValidAgentId(id: string): id is VirtualAgentId {
  return virtualAgentsRegistry.some(agent => agent.id === id);
}
