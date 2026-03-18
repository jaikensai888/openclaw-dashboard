'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { ExpertForm } from './ExpertForm';
import type { Expert } from '@/stores/chatStore';
import { API_BASE_URL } from '@/lib/api';

interface ExpertModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  expert?: Expert | null;
  categories: string[];
  onClose: () => void;
  onSuccess: (expert: Expert) => void;
}

export function ExpertModal({
  open,
  mode,
  expert,
  categories,
  onClose,
  onSuccess,
}: ExpertModalProps) {
  const [formData, setFormData] = useState<Partial<Expert>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when modal opens or expert changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && expert) {
        setFormData({
          name: expert.name,
          title: expert.title,
          description: expert.description,
          category: expert.category,
          systemPrompt: expert.systemPrompt,
          color: expert.color,
          icon: expert.icon,
        });
      } else {
        // Reset for create mode
        setFormData({
          name: '',
          title: '',
          description: '',
          category: '',
          systemPrompt: '',
          color: '#0ea5e9',
          icon: 'bot',
        });
      }
      setError(null);
    }
  }, [open, mode, expert]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.name?.trim() || !formData.title?.trim() ||
        !formData.category?.trim() || !formData.systemPrompt?.trim()) {
      setError('请填写所有必填字段');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = mode === 'edit' && expert
        ? `${API_BASE_URL}/experts/${expert.id}`
        : `${API_BASE_URL}/experts`;
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
      console.error('Failed to save expert:', err);
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
      aria-labelledby="expert-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-neutral-800 rounded-xl border border-neutral-700 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 id="expert-modal-title" className="text-lg font-semibold">
            {mode === 'edit' ? '编辑专家' : '新增专家'}
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
        <div className="flex-1 overflow-y-auto p-4">
          <ExpertForm
            value={formData}
            onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
            categories={categories}
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
