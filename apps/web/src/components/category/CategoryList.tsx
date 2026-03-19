'use client';

import { useState } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import type { Category } from './CategoryForm';
import { cn } from '@/lib/utils';

interface CategoryWithCount extends Category {
  expertCount: number;
}

interface CategoryListProps {
  categories: CategoryWithCount[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  loading?: boolean;
}

export function CategoryList({ categories, onEdit, onDelete, loading }: CategoryListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDeleteClick = (category: Category) => {
    if (deleteConfirm === category.id) {
      onDelete(category);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(category.id);
      // Auto-reset after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-12">
        <p>暂无分类</p>
        <p className="text-sm mt-1">点击上方「新增分类」按钮创建</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-neutral-700/50 text-sm font-medium text-neutral-300 border-b border-neutral-700">
        <div className="col-span-3">名称</div>
        <div className="col-span-5">描述</div>
        <div className="col-span-2 text-center">专家数</div>
        <div className="col-span-2 text-right">操作</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-neutral-700">
        {categories.map((category) => (
          <div
            key={category.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-neutral-700/30 transition-colors"
          >
            <div className="col-span-3 font-medium text-white truncate">
              {category.name}
            </div>
            <div className="col-span-5 text-sm text-neutral-400 truncate">
              {category.description || '-'}
            </div>
            <div className="col-span-2 text-center text-sm text-neutral-300">
              {category.expertCount}
            </div>
            <div className="col-span-2 flex justify-end gap-1">
              <button
                onClick={() => onEdit(category)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                aria-label="编辑分类"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(category)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors flex items-center gap-1',
                  deleteConfirm === category.id
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                )}
                aria-label={deleteConfirm === category.id ? '确认删除' : '删除分类'}
              >
                {deleteConfirm === category.id ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs">确认?</span>
                  </>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { CategoryWithCount };
