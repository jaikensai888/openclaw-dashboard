'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { ExpertCard } from './ExpertCard';
import { ExpertModal } from './ExpertModal';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
import type { Expert } from '@/stores/chatStore';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  expertCount: number;
}

const UNCATALOGIZED_KEY = '__uncategorized__';

export function ExpertCenter() {
  const { experts, setExperts, setCurrentView, setCurrentExpertId, createConversation, updateExpert, addExpert } = useChatStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingExpert, setEditingExpert] = useState<Expert | null>(null);

  // Fetch experts and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Build experts URL based on selected category
        let expertsUrl: string;
        if (selectedCategory === UNCATALOGIZED_KEY) {
          expertsUrl = `${API_BASE_URL}/experts?category=null`;
        } else if (selectedCategory) {
          expertsUrl = `${API_BASE_URL}/experts?category=${encodeURIComponent(selectedCategory)}`;
        } else {
          expertsUrl = `${API_BASE_URL}/experts`;
        }

        // Fetch experts
        const expertsRes = await fetch(expertsUrl);
        const expertsData = await expertsRes.json();
        if (expertsData.success) {
          setExperts(expertsData.data);
        }

        // Fetch categories from new API
        const categoriesRes = await fetch(`${API_BASE_URL}/categories`);
        const categoriesData = await categoriesRes.json();
        if (categoriesData.success) {
          setCategories(categoriesData.data);
        }
      } catch (error) {
        console.error('Failed to fetch experts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory, setExperts]);

  const handleSummon = (expert: Expert) => {
    // Create new conversation with this expert
    const convId = createConversation();
    setCurrentExpertId(expert.id);
    setCurrentView('chat');

    // TODO: Also send to server via WebSocket
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingExpert(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (expert: Expert) => {
    setModalMode('edit');
    setEditingExpert(expert);
    setModalOpen(true);
  };

  const handleSaveExpert = (expert: Expert) => {
    if (modalMode === 'edit') {
      updateExpert(expert.id, expert);
    } else {
      addExpert(expert);
    }
  };

  // Count uncategorized experts
  const uncategorizedCount = experts.filter(e => !e.category).length;

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
            <h1 className="text-2xl font-semibold mb-2">专家中心</h1>
            <p className="text-sm text-neutral-500">
              按行业分类浏览专家，召唤他们为你服务
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新增专家</span>
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-6 py-3 border-b border-neutral-700 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
            selectedCategory === null
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
              selectedCategory === cat.name
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            )}
          >
            {cat.name} ({cat.expertCount})
          </button>
        ))}
        {/* Uncategorized Tab - show if there are uncategorized experts */}
        {uncategorizedCount > 0 && (
          <button
            onClick={() => setSelectedCategory(UNCATALOGIZED_KEY)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
              selectedCategory === UNCATALOGIZED_KEY
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            )}
          >
            未分类 ({uncategorizedCount})
          </button>
        )}
      </div>

      {/* Expert grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {experts.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            <p>暂无专家</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {experts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                onSummon={handleSummon}
                onEdit={handleOpenEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expert Modal */}
      <ExpertModal
        open={modalOpen}
        mode={modalMode}
        expert={editingExpert}
        categories={categories.map((c) => c.name)}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSaveExpert}
      />
    </main>
  );
}
