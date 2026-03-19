'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { CategoryList, type CategoryWithCount } from '@/components/category/CategoryList';
import { CategoryModal } from '@/components/category/CategoryModal';
import type { Category } from '@/components/category/CategoryForm';
import { API_BASE_URL } from '@/lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/categories`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingCategory(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setModalMode('edit');
    setEditingCategory(category);
    setModalOpen(true);
  };

  const handleSaveCategory = (_category: Category) => {
    fetchCategories();
  };

  const handleDeleteCategory = async (category: Category) => {
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${category.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchCategories();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <main className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <div className="border-b border-neutral-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                aria-label="返回"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">分类管理</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  管理专家分类，删除后专家将变为未分类
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新增分类</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <CategoryList
          categories={categories}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteCategory}
          loading={loading}
        />
      </div>

      {/* Modal */}
      <CategoryModal
        open={modalOpen}
        mode={modalMode}
        category={editingCategory}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSaveCategory}
      />
    </main>
  );
}
