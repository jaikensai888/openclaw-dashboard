/**
 * FE-04: 规则列表组件
 *
 * 文件：apps/web/src/components/rules/RuleList.tsx
 */

'use client';

import { useEffect, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { useRuleStore } from '@/stores/ruleStore';
import { RuleCard } from './RuleCard';
import { RuleModal } from './RuleModal';
import type { Rule } from '@/stores/ruleStore';

export function RuleList() {
  const { rules, isLoading, error, fetchRules, createRule, updateRule, deleteRule, toggleRule } = useRuleStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleCreate = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条规则吗？')) {
      await deleteRule(id);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await toggleRule(id, enabled);
  };

  const handleSave = async (data: Parameters<typeof createRule>[0]) => {
    if (editingRule) {
      await updateRule(editingRule.id, data);
    } else {
      await createRule(data);
    }
    setIsModalOpen(false);
    setEditingRule(null);
  };

  if (isLoading && rules.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">规则管理</h1>
          <p className="text-neutral-400 mt-1">
            规则用于自定义 AI 的初始化行为，启用后会在每次会话开始时自动注入到 AI 的系统提示中。
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建规则
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {/* Rule List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <p className="text-neutral-400">暂无规则</p>
            <button
              onClick={handleCreate}
              className="mt-4 text-primary-500 hover:text-primary-400"
            >
              创建第一条规则
            </button>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => handleEdit(rule)}
              onDelete={() => handleDelete(rule.id)}
              onToggle={(enabled) => handleToggle(rule.id, enabled)}
            />
          ))
        )}
      </div>

      {/* Modal */}
      <RuleModal
        isOpen={isModalOpen}
        rule={editingRule}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
