'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useRuleStore } from '@/stores/ruleStore';
import { RuleCard } from '@/components/rules/RuleCard';
import { RuleModal } from '@/components/rules/RuleModal';
import type { Rule, CreateRuleInput, UpdateRuleInput } from '@/lib/api';

export default function RulesPage() {
  const { rules, isLoading, error, fetchRules, createRule, updateRule, deleteRule, toggleRule } = useRuleStore();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleBack = () => {
    window.history.back();
  };

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

  const handleSave = async (data: CreateRuleInput | UpdateRuleInput) => {
    if (editingRule) {
      await updateRule(editingRule.id, data as UpdateRuleInput);
    } else {
      await createRule(data as CreateRuleInput);
    }
    setIsModalOpen(false);
    setEditingRule(null);
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <div className="border-b border-neutral-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                aria-label="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">规则管理</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  管理会话初始化规则，启用后自动注入到 AI 系统提示
                </p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新建规则</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && rules.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-400">加载中...</div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && rules.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-neutral-500" />
            </div>
            <p className="text-neutral-400 mb-4">暂无规则</p>
            <button
              onClick={handleCreate}
              className="text-primary-500 hover:text-primary-400"
            >
              创建第一条规则
            </button>
          </div>
        )}

        {/* Rule List */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => handleEdit(rule)}
              onDelete={() => handleDelete(rule.id)}
              onToggle={(enabled) => handleToggle(rule.id, enabled)}
            />
          ))}
        </div>
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
    </main>
  );
}
