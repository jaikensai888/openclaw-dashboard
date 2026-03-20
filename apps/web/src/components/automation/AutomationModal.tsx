'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Automation } from '@/stores/chatStore';
import { API_BASE_URL } from '@/lib/api';

interface Expert {
  id: string;
  name: string;
  title: string;
}

interface AutomationModalProps {
  open: boolean;
  experts: Expert[];
  onClose: () => void;
  onSuccess: (automation: Automation) => void;
}

export function AutomationModal({ open, experts, onClose, onSuccess }: AutomationModalProps) {
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setInput('');
      setAgentId(experts[0]?.id || '');
      setError(null);
    }
  }, [open, experts]);

  const handleSubmit = async () => {
    if (!input.trim()) {
      setError('请输入任务描述');
      return;
    }
    if (!agentId) {
      setError('请选择执行专家');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          agentId,
          status: 'active',
        }),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess(data.data);
        onClose();
      } else {
        setError(data.error || '创建失败');
      }
    } catch (err) {
      console.error('Failed to create automation:', err);
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
      aria-labelledby="automation-modal-title"
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
          <h2 id="automation-modal-title" className="text-lg font-semibold">
            新增定时任务
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
        <div className="p-4 space-y-4">
          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              任务描述 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         resize-none"
              placeholder="例如: 每天9点，查询天气并且告诉我"
            />
          </div>

          {/* Expert Select */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              执行专家 <span className="text-red-400">*</span>
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">选择专家</option>
              {experts.map((expert) => (
                <option key={expert.id} value={expert.id}>
                  {expert.name} - {expert.title}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
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
            {saving ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
