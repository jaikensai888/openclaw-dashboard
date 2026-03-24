/**
 * BE-04: 规则服务层
 *
 * 文件：apps/server/src/services/ruleService.ts
 */

import { getDatabase } from '../db/index.js';

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string | null;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * 获取所有启用的规则，按优先级降序排列
 */
export function getEnabledRules(): Rule[] {
  const db = getDatabase();

  const result = db.exec(
    'SELECT * FROM rules WHERE is_enabled = 1 ORDER BY priority DESC, created_at ASC'
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return [];
  }

  return result[0].values.map((row: unknown[]) => ({
    id: row[0] as string,
    name: row[1] as string,
    description: row[2] as string | null,
    template: row[3] as string,
    variables: row[4] as string | null,
    is_enabled: row[5] as number,
    priority: row[6] as number,
    created_at: row[7] as string,
    updated_at: row[8] as string,
  }));
}

/**
 * 渲染规则模板，替换 {{var}} 变量
 * @param template 模板字符串
 * @param variables 变量键值对
 * @returns 渲染后的字符串
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

/**
 * 为指定会话渲染所有启用的规则
 * @param conversationId 会话 ID
 * @returns 合并后的规则文本
 */
export function renderRulesForConversation(conversationId: string): string {
  const rules = getEnabledRules();

  if (rules.length === 0) {
    return '';
  }

  // 准备变量
  const cwd = process.cwd();
  const workDir = `${cwd}/data/conversations/${conversationId}`;

  const variables: Record<string, string> = {
    conversationId,
    workDir,
    cwd,
  };

  // 渲染并合并所有规则
  const renderedRules = rules.map((rule) => renderTemplate(rule.template, variables));

  return '\n\n' + renderedRules.join('\n\n');
}
