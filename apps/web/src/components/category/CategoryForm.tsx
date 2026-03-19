'use client';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormProps {
  value: Partial<Category>;
  onChange: (updates: Partial<Category>) => void;
}

export function CategoryForm({ value, onChange }: CategoryFormProps) {
  const handleChange = (field: keyof Category, fieldValue: string | number) => {
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
          placeholder="分类名称"
        />
      </div>

      {/* 描述 */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          描述
        </label>
        <textarea
          value={value.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                     resize-none"
          placeholder="分类描述（可选）"
        />
      </div>
    </div>
  );
}
