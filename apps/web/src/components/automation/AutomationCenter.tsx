'use client';

import { useState, useEffect } from 'react';
import { Plus, Clock } from 'lucide-react';
import { useChatStore, type Automation } from '@/stores/chatStore';
import { AutomationItem } from './AutomationItem';
import { API_BASE_URL } from '@/lib/api';

export function AutomationCenter() {
  const { automations, setAutomations } = useChatStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAutomations = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/automations?status=active&status=paused`);
        const data = await res.json();
        if (data.success) {
          setAutomations(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch automations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAutomations();
  }, [setAutomations]);

  const handleToggleStatus = async (id: string, status: 'active' | 'paused') => {
    try {
      const res = await fetch(`${API_BASE_URL}/automations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setAutomations(automations.map((a) => (a.id === id ? data.data : a)));
      }
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个自动化任务吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/automations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAutomations(automations.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete automation:', error);
    }
  };

  const handleRun = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/automations/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Update the automation with new lastRunAt
        setAutomations(automations.map((a) => (a.id === id ? data.data : a)));
      }
    } catch (error) {
      console.error('Failed to run automation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-neutral-900 overflow-hidden" role="main">
      {/* Header */}
      <div className="p-6 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">自动化</h1>
              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
                Beta
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              管理自动化任务并查看近期运行记录
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              <span>添加</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors text-neutral-300">
              <span>从模版添加</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {automations.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto mb-4 text-neutral-600" aria-hidden="true" />
            <p className="text-neutral-500">暂无自动化任务</p>
            <p className="text-sm text-neutral-600 mt-2">点击"添加"创建你的第一个自动化任务</p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-medium text-neutral-500 mb-4">已安排</h3>
            <div className="space-y-3">
              {automations.map((automation) => (
                <AutomationItem
                  key={automation.id}
                  automation={automation}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                  onRun={handleRun}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
