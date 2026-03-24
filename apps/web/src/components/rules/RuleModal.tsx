'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Rule, CreateRuleInput, UpdateRuleInput } from '@/lib/api';

interface RuleModalProps {
  isOpen: boolean;
  rule: Rule | null;
  onClose: () => void;
  onSave: (data: CreateRuleInput | UpdateRuleInput) => void;
}

const VARIABLE_OPTIONS = [
  { name: 'conversationId', description: '当前会话 ID' },
  { name: 'workDir', description: '会话工作目录' },
  { name: 'cwd', description: '服务器当前目录' },
];

export function RuleModal({ isOpen, rule, onClose, onSave }: RuleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
    variables: [] as string[],
    isEnabled: true,
    priority: 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        description: rule.description || '',
        template: rule.template,
        variables: rule.variables,
        isEnabled: rule.isEnabled,
        priority: rule.priority,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        template: '',
        variables: [],
        isEnabled: true,
        priority: 1,
      });
    }
    setErrors({});
  }, [rule]);

  if (!isOpen) return null;

  const handleChange = (
    field: string,
    value: string | number | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleVariableToggle = (varName: string) => {
    setFormData((prev) => {
      const variables = prev.variables.includes(varName)
        ? prev.variables.filter((v) => v !== varName)
        : [...prev.variables, varName];
      return { ...prev, variables };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '规则名称不能为空';
    }
    if (!formData.template.trim()) {
      newErrors.template = '规则模板不能为空';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      name: formData.name,
      description: formData.description || undefined,
      template: formData.template,
      variables: formData.variables.length > 0 ? formData.variables : undefined,
      isEnabled: formData.isEnabled,
      priority: formData.priority,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-neutral-800 border border-neutral-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-white">
            {rule ? '编辑规则' : '新建规则'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Name */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              规则名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 bg-neutral-900 border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.name ? 'border-red-500' : 'border-neutral-700'
              }`}
              placeholder="例如：文件保存协议"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              描述
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="规则用途说明"
            />
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              规则模板 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.template}
              onChange={(e) => handleChange('template', e.target.value)}
              rows={8}
              className={`w-full px-3 py-2 bg-neutral-900 border rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
                errors.template ? 'border-red-500' : 'border-neutral-700'
              }`}
              placeholder={"## 规则标题\n你的工作目录是: {{workDir}}/\n\n请遵守以下规则..."}
            />
            {errors.template && (
              <p className="text-red-500 text-xs mt-1">{errors.template}</p>
            )}
            <p className="text-neutral-500 text-xs mt-1">
              💡 使用 {`{{变量名}}`} 语法插入变量， 如 {`{{conversationId}}`}, {`{{workDir}}`}, {`{{cwd}}`}
            </p>
          </div>

          {/* Variables */}
          <div>
            <label className="block text-sm text-neutral-400 mb-2">
              可用变量
            </label>
            <div className="flex flex-wrap gap-2">
              {VARIABLE_OPTIONS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => handleVariableToggle(option.name)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    formData.variables.includes(option.name)
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  }`}
                  title={option.description}
                >
                  {`{{${option.name}}}`}
                </button>
              ))}
            </div>
            <p className="text-neutral-500 text-xs mt-2">
              点击选择模板中需要的变量
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              优先级
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value) || 0)}
              className="w-24 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-neutral-500 text-xs mt-1">
              数字越大越先注入
            </p>
          </div>

          {/* Is Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_enabled"
              checked={formData.isEnabled}
              onChange={(e) => handleChange('isEnabled', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_enabled" className="text-sm text-neutral-300">
              启用此规则
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
