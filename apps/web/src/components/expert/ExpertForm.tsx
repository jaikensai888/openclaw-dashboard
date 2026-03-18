'use client';

import { Bot, User, Code, PenTool, BarChart2, Search, Briefcase, Palette, LucideIcon } from 'lucide-react';
import type { Expert } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

interface ExpertFormProps {
  value: Partial<Expert>;
  onChange: (updates: Partial<Expert>) => void;
  categories: string[];
}

// 可用图标列表
const AVAILABLE_ICONS: { value: string; label: string; component: LucideIcon }[] = [
  { value: 'bot', label: '机器人', component: Bot },
  { value: 'user', label: '用户', component: User },
  { value: 'code', label: '代码', component: Code },
  { value: 'pen-tool', label: '写作', component: PenTool },
  { value: 'bar-chart-2', label: '数据', component: BarChart2 },
  { value: 'search', label: '搜索', component: Search },
  { value: 'briefcase', label: '商务', component: Briefcase },
  { value: 'palette', label: '设计', component: Palette },
];

// 预设颜色
const PRESET_COLORS = [
  '#0ea5e9', // sky-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

export function ExpertForm({ value, onChange, categories }: ExpertFormProps) {
  const handleChange = (field: keyof Expert, fieldValue: string) => {
    onChange({ [field]: fieldValue });
  };

  return (
    <div className="space-y-4">
      {/* 名称 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="专家名称"
        />
      </div>

      {/* 备注头衔 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          备注头衔 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={value.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="如：内容创作专家"
        />
      </div>

      {/* 分类 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          分类 <span className="text-red-400">*</span>
        </label>
        <select
          value={value.category || ''}
          onChange={(e) => handleChange('category', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">选择分类</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* 简介 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          简介
        </label>
        <input
          type="text"
          value={value.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="简短描述专家的专长"
        />
      </div>

      {/* 系统提示词 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          系统提示词 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={value.systemPrompt || ''}
          onChange={(e) => handleChange('systemPrompt', e.target.value)}
          rows={4}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     resize-none font-mono"
          placeholder="你是xxx，一位专业的..."
        />
      </div>

      {/* 外观设置分隔线 */}
      <div className="border-t border-neutral-700 pt-4 mt-4">
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
          外观设置
        </h4>

        {/* 主题色 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            主题色
          </label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange('color', color)}
                className={cn(
                  'w-8 h-8 rounded-lg border-2 transition-all',
                  value.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                aria-label={`选择颜色 ${color}`}
              />
            ))}
          </div>
        </div>

        {/* 图标 */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">
            图标
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVAILABLE_ICONS.map((icon) => {
              const IconComponent = icon.component;
              return (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => handleChange('icon', icon.value)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                    value.icon === icon.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                  )}
                  aria-label={icon.label}
                  title={icon.label}
                >
                  <IconComponent className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
