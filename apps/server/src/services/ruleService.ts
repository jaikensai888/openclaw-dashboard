/**
 * Rule Service
 *
 * 稡板变量插值和规则渲染服务
 */

import { all } from '../db/index.js';

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  template: string;
  variables: string[];
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface RuleRow {
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
  const rows = all<RuleRow>(
    'SELECT * FROM rules WHERE is_enabled = 1 ORDER BY priority DESC, created_at ASC'
  );

  return rows.map(rowToRule);
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
  const renderedRules = rules.map((rule) =>
    renderTemplate(rule.template, variables)
  );

  return '\n\n' + renderedRules.join('\n\n');
}

/**
 * 行数据转 Rule 对象
 */
function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    template: row.template,
    variables: row.variables ? JSON.parse(row.variables) : [],
    isEnabled: row.is_enabled === 1,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
