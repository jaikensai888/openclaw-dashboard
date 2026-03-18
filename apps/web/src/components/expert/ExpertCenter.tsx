'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { ExpertCard } from './ExpertCard';
import { cn } from '@/lib/utils';
import type { Expert } from '@/stores/chatStore';

interface Category {
  category: string;
  count: number;
}

export function ExpertCenter() {
  const { experts, setExperts, setCurrentView, setCurrentExpertId, createConversation } = useChatStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch experts and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch experts
        const expertsUrl = selectedCategory
          ? `/api/v1/experts?category=${encodeURIComponent(selectedCategory)}`
          : '/api/v1/experts';
        const expertsRes = await fetch(expertsUrl);
        const expertsData = await expertsRes.json();
        if (expertsData.success) {
          setExperts(expertsData.data);
        }

        // Fetch categories
        const categoriesRes = await fetch('/api/v1/experts/categories');
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
        <h1 className="text-2xl font-semibold mb-2">专家中心</h1>
        <p className="text-sm text-neutral-500">
          按行业分类浏览专家，召唤他们为你服务
        </p>
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
            key={cat.category}
            onClick={() => setSelectedCategory(cat.category)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
              selectedCategory === cat.category
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            )}
          >
            {cat.category} ({cat.count})
          </button>
        ))}
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
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
