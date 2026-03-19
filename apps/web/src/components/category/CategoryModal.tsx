'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { CategoryForm, type Category } from './CategoryForm';
import { API_BASE_URL } from '@/lib/api';

interface CategoryModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  category?: Category | null;
  onClose: () => void;
  onSuccess: (category: Category) => void;
}

export function CategoryModal({
  open,
  mode,
  category,
  onClose,
  onSuccess,
}: CategoryModalProps) {
  const [formData, setFormData] = useState<Partial<Category>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or category changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && category) {
        setFormData({
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
        });
      } else {
        // Reset for create mode
        setFormData({
          name: '',
          description: '',
          sortOrder: 0,
        });
      }
      setError(null);
    }
  }, [open, mode, category]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.name?.trim()) {
      setError('请填写分类名称');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = mode === 'edit' && category
        ? `${API_BASE_URL}/categories/${category.id}`
        : `${API_BASE_URL}/categories`;
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess(data.data);
        onClose();
      } else {
        setError(data.error || '保存失败');
      }
    } catch (err) {
      console.error('Failed to save category:', err);
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 id="category-modal-title" className="text-lg font-semibold">
            {mode === 'edit' ? '编辑分类' : '新增分类'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <CategoryForm
            value={formData}
            onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
          />

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-white transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '保存中...' : (mode === 'edit' ? '保存' : '创建')}
          </button>
        </div>
      </div>
    </div>
  );
}
