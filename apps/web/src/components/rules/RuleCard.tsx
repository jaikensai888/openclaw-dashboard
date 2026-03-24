'use client';

import { Edit, Trash2, FileText } from 'lucide-react';
import type { Rule } from '@/lib/api';

interface RuleCardProps {
  rule: Rule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}

export function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
  return (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 group hover:border-neutral-600 transition-colors">
      <div className="flex items-center justify-between">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-neutral-700 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium truncate">{rule.name}</h3>
              {!rule.isEnabled && (
                <span className="px-2 py-0.5 text-xs bg-neutral-700 text-neutral-400 rounded">
                  已禁用
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
              <span>优先级 {rule.priority}</span>
              {rule.variables.length > 0 && (
                <span className="truncate">
                  变量: {rule.variables.map(v => `{{${v}}}`).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Toggle + Actions */}
        <div className="flex items-center gap-2">
          {/* Toggle Switch */}
          <button
            onClick={() => onToggle(!rule.isEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              rule.isEnabled ? 'bg-primary-600' : 'bg-neutral-600'
            }`}
            title={rule.isEnabled ? '点击禁用' : '点击启用'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                rule.isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-lg transition-colors"
              title="编辑"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-neutral-700 rounded-lg transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Description (if exists) */}
      {rule.description && (
        <p className="text-neutral-400 text-sm mt-3" style={{ marginLeft: '52px' }}>
          {rule.description}
        </p>
      )}
    </div>
  );
}
