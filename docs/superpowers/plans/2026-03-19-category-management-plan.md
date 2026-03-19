# 专家分类管理实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现独立的专家分类管理功能，支持新增、编辑、删除分类，分类与专家解耦。

**Architecture:** 后端新增 categories 表和 CRUD API，前端新建 /settings/categories 设置页面，采用表格 + 模态框编辑模式，与现有 ExpertModal 模式一致。

**Tech Stack:** Fastify + SQLite (后端), Next.js App Router + React + Zustand (前端)

---

## 文件结构

### 后端
- `apps/server/src/routes/categories.ts` - 分类 CRUD API
- `apps/server/src/db/index.ts` - 添加 categories 表迁移和种子数据

### 前端
- `apps/web/src/app/settings/categories/page.tsx` - 分类管理页面
- `apps/web/src/components/category/CategoryList.tsx` - 分类列表表格
- `apps/web/src/components/category/CategoryModal.tsx` - 新增/编辑模态框
- `apps/web/src/components/category/CategoryForm.tsx` - 分类表单组件
- `apps/web/src/components/layout/Sidebar.tsx` - 添加设置入口（修改）
- `apps/web/src/components/expert/ExpertCenter.tsx` - Tab 数据源改动（修改）
- `apps/web/src/components/expert/ExpertForm.tsx` - 分类选择器改动（修改）

---

## Chunk 1: 后端 - 数据库与 API

### Task 1: 添加 categories 表迁移

**Files:**
- Modify: `apps/server/src/db/index.ts:70-166`

- [ ] **Step 1: 添加 categories 表迁移代码**

在 `runMigrations` 函数末尾（Migration 5 之后）添加 Migration 6：

```typescript
  // Migration 6: Create categories table if not exists
  try {
    database.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.run(`CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order)`);
    console.log('[DB] Migration: categories table created');
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
```

- [ ] **Step 2: 修改 experts 表的 category 字段为可空**

在 Migration 6 之后添加 Migration 7（SQLite 不支持 ALTER COLUMN，需要重建表）：

```typescript
  // Migration 7: Make experts.category nullable
  try {
    // Check if category column is already nullable by trying to insert null
    const testTable = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='experts'");
    const createSql = testTable[0]?.values?.[0]?.[0] as string || '';

    // Only migrate if category is NOT NULL
    if (createSql.includes('category TEXT NOT NULL')) {
      console.log('[DB] Migration: Making experts.category nullable');

      // Create new table with nullable category
      database.run(`
        CREATE TABLE experts_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          avatar TEXT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          system_prompt TEXT NOT NULL,
          color TEXT,
          icon TEXT,
          is_default INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Copy data
      database.run(`
        INSERT INTO experts_new SELECT * FROM experts
      `);

      // Drop old table and rename
      database.run('DROP TABLE experts');
      database.run('ALTER TABLE experts_new RENAME TO experts');
      database.run('CREATE INDEX IF NOT EXISTS idx_experts_category ON experts(category)');
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
```

- [ ] **Step 3: 添加种子分类数据**

在 `seedDefaultExperts` 函数之后添加 `seedDefaultCategories` 函数，并在 `initDatabase` 中调用：

```typescript
/**
 * Seed default categories if none exist
 */
export function seedDefaultCategories(): void {
  const count = get<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (count && count.count > 0) {
    return; // Already seeded
  }

  console.log('[DB] Seeding default categories...');
  const now = new Date().toISOString();

  // Get unique categories from experts
  const expertCategories = all<{ category: string; count: number }>(
    'SELECT category, COUNT(*) as count FROM experts GROUP BY category'
  );

  // Create categories from existing expert categories
  expertCategories.forEach((row, index) => {
    run(
      `INSERT INTO categories (id, name, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`cat_${index}`, row.category, null, index, now, now]
    );
  });

  console.log('[DB] Default categories seeded');
}
```

然后在 `initDatabase` 函数中，在 `seedDefaultExperts()` 调用之后添加：

```typescript
seedDefaultCategories();
```

- [ ] **Step 4: 提交数据库迁移**

```bash
git add apps/server/src/db/index.ts
git commit -m "feat(db): 添加 categories 表迁移和种子数据

- 新增 categories 表 (id, name, description, sort_order)
- 修改 experts.category 为可空字段
- 从现有专家数据生成默认分类"
```

---

### Task 2: 创建分类 CRUD API

**Files:**
- Create: `apps/server/src/routes/categories.ts`

- [ ] **Step 1: 创建 categories.ts 路由文件**

```typescript
/**
 * Categories API Routes
 */

import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../db/index.js';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CategoryWithCount extends CategoryRow {
  expert_count: number;
}

function rowToCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function categoryRoutes(fastify: FastifyInstance) {
  // List all categories with expert counts
  fastify.get('/categories', async (request, reply) => {
    const rows = all<CategoryWithCount>(`
      SELECT c.*, COUNT(e.id) as expert_count
      FROM categories c
      LEFT JOIN experts e ON c.name = e.category
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);

    return {
      success: true,
      data: rows.map((row) => ({
        ...rowToCategory(row),
        expertCount: row.expert_count,
      })),
    };
  });

  // Get single category
  fastify.get<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const row = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);

    if (!row) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    return { success: true, data: rowToCategory(row) };
  });

  // Create category
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      sortOrder?: number;
    };
  }>('/categories', async (request, reply) => {
    const { name, description, sortOrder } = request.body;

    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: 'Category name is required' });
    }

    // Check for duplicate name
    const existing = get<CategoryRow>('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing) {
      return reply.status(409).send({ success: false, error: 'Category name already exists' });
    }

    const id = `cat_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO categories (id, name, description, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), description || null, sortOrder || 0, now, now]
    );

    return {
      success: true,
      data: {
        id,
        name: name.trim(),
        description: description || null,
        sortOrder: sortOrder || 0,
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  // Update category
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      sortOrder?: number;
    };
  }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, description, sortOrder } = request.body;

    const existing = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    // Check for duplicate name if name is being changed
    if (name !== undefined && name !== existing.name) {
      const duplicate = get<CategoryRow>('SELECT id FROM categories WHERE name = ? AND id != ?', [name.trim(), id]);
      if (duplicate) {
        return reply.status(409).send({ success: false, error: 'Category name already exists' });
      }
    }

    const now = new Date().toISOString();
    const newName = name !== undefined ? name.trim() : existing.name;
    const newDescription = description !== undefined ? description : existing.description;
    const newSortOrder = sortOrder !== undefined ? sortOrder : existing.sort_order;

    run(
      `UPDATE categories SET name = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [newName, newDescription, newSortOrder, now, id]
    );

    // If category name changed, update all experts with old category
    if (newName !== existing.name) {
      run(`UPDATE experts SET category = ? WHERE category = ?`, [newName, existing.name]);
    }

    return {
      success: true,
      data: {
        id,
        name: newName,
        description: newDescription,
        sortOrder: newSortOrder,
        createdAt: existing.created_at,
        updatedAt: now,
      },
    };
  });

  // Delete category
  fastify.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = get<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Category not found' });
    }

    // Set all experts with this category to null (uncategorized)
    run(`UPDATE experts SET category = NULL WHERE category = ?`, [existing.name]);

    // Delete the category
    run('DELETE FROM categories WHERE id = ?', [id]);

    return { success: true };
  });
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

修改 `apps/server/src/app.ts`:

在文件顶部添加导入：
```typescript
import { categoryRoutes } from './routes/categories.js';
```

在 API routes 注册部分添加：
```typescript
api.register(categoryRoutes);
```

- [ ] **Step 3: 提交后端 API**

```bash
git add apps/server/src/routes/categories.ts apps/server/src/app.ts
git commit -m "feat(api): 添加分类 CRUD API

- GET /categories - 获取所有分类（含专家数量）
- POST /categories - 新增分类
- PUT /categories/:id - 更新分类
- DELETE /categories/:id - 删除分类（专家变为未分类）"
```

---

## Chunk 2: 前端 - 分类管理组件

### Task 3: 创建 CategoryForm 组件

**Files:**
- Create: `apps/web/src/components/category/CategoryForm.tsx`

- [ ] **Step 1: 创建 category 目录**

```bash
mkdir -p apps/web/src/components/category
```

- [ ] **Step 2: 创建 CategoryForm.tsx**

```typescript
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
```

- [ ] **Step 3: 提交 CategoryForm**

```bash
git add apps/web/src/components/category/CategoryForm.tsx
git commit -m "feat(ui): 添加 CategoryForm 表单组件"
```

---

### Task 4: 创建 CategoryModal 组件

**Files:**
- Create: `apps/web/src/components/category/CategoryModal.tsx`

- [ ] **Step 1: 创建 CategoryModal.tsx**

```typescript
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
```

- [ ] **Step 2: 提交 CategoryModal**

```bash
git add apps/web/src/components/category/CategoryModal.tsx
git commit -m "feat(ui): 添加 CategoryModal 模态框组件"
```

---

### Task 5: 创建 CategoryList 组件

**Files:**
- Create: `apps/web/src/components/category/CategoryList.tsx`

- [ ] **Step 1: 创建 CategoryList.tsx**

```typescript
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
```

- [ ] **Step 2: 提交 CategoryList**

```bash
git add apps/web/src/components/category/CategoryList.tsx
git commit -m "feat(ui): 添加 CategoryList 列表组件"
```

---

### Task 6: 创建分类管理页面

**Files:**
- Create: `apps/web/src/app/settings/categories/page.tsx`

- [ ] **Step 1: 创建页面目录**

```bash
mkdir -p apps/web/src/app/settings/categories
```

- [ ] **Step 2: 创建页面文件**

```typescript
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
```

- [ ] **Step 3: 提交分类管理页面**

```bash
git add apps/web/src/app/settings/categories/page.tsx
git commit -m "feat(page): 添加分类管理页面 /settings/categories"
```

---

## Chunk 3: 前端 - 集成改动

### Task 7: 修改 Sidebar 添加设置入口

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 添加导入 Settings2 图标**

在文件顶部的 lucide-react 导入中添加 `Settings2` 和 `Folder`：

```typescript
import { MessageSquare, Plus, Settings, Settings2, Trash2, Menu, X, Pin, Pencil, Check, Search, Bot, Users, Clock, Folder } from 'lucide-react';
```

- [ ] **Step 2: 在导航区域添加设置分组**

在 `{/* Navigation */}` 部分的 `NavItem` 列表之后添加设置分组：

```typescript
        {/* Navigation */}
        <div className="px-3 py-2 space-y-1 border-b border-neutral-700">
          <NavItem
            icon={Bot}
            label="Claw"
            isActive={currentView === 'chat'}
            onClick={() => setCurrentView('chat')}
          />
          <NavItem
            icon={Users}
            label="专家"
            isActive={currentView === 'expert'}
            onClick={() => setCurrentView('expert')}
          />
          <NavItem
            icon={Clock}
            label="自动化"
            isActive={currentView === 'automation'}
            onClick={() => setCurrentView('automation')}
            badge="Beta"
          />
        </div>

        {/* Settings Group */}
        <div className="px-3 py-2 space-y-1 border-b border-neutral-700">
          <div className="px-3 py-1.5 text-xs text-neutral-500 font-medium uppercase tracking-wider">
            设置
          </div>
          <button
            onClick={() => window.location.href = '/settings/categories'}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-neutral-700 text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Folder className="w-5 h-5" />
            <span className="text-sm">分类管理</span>
          </button>
        </div>
```

- [ ] **Step 3: 提交 Sidebar 改动**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): 添加设置分组和分类管理入口"
```

---

### Task 8: 修改 ExpertCenter 使用 categories API

**Files:**
- Modify: `apps/web/src/components/expert/ExpertCenter.tsx`

- [ ] **Step 1: 修改 categories 状态类型和获取方式**

修改 Category 接口和 categories 获取逻辑：

```typescript
interface Category {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  expertCount: number;
}

// 在 useEffect 中修改获取 categories 的逻辑
// Fetch categories
const categoriesRes = await fetch(`${API_BASE_URL}/categories`);
const categoriesData = await categoriesRes.json();
if (categoriesData.success) {
  setCategories(categoriesData.data);
}
```

- [ ] **Step 2: 添加「未分类」Tab 显示逻辑**

在分类 Tab 渲染部分添加未分类 Tab：

```typescript
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
        {(() => {
          const uncategorizedCount = experts.filter(e => !e.category).length;
          if (uncategorizedCount === 0) return null;
          return (
            <button
              onClick={() => setSelectedCategory('__uncategorized__')}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors',
                selectedCategory === '__uncategorized__'
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              )}
            >
              未分类 ({uncategorizedCount})
            </button>
          );
        })()}
      </div>
```

- [ ] **Step 3: 修改专家过滤逻辑**

在获取专家列表时处理未分类情况：

```typescript
// Fetch experts - 需要处理 __uncategorized__ 情况
let expertsUrl: string;
if (selectedCategory === '__uncategorized__') {
  expertsUrl = `${API_BASE_URL}/experts?category=null`;
} else if (selectedCategory) {
  expertsUrl = `${API_BASE_URL}/experts?category=${encodeURIComponent(selectedCategory)}`;
} else {
  expertsUrl = `${API_BASE_URL}/experts`;
}
```

- [ ] **Step 4: 修改 ExpertModal 的 categories prop**

```typescript
<ExpertModal
  open={modalOpen}
  mode={modalMode}
  expert={editingExpert}
  categories={categories.map((c) => c.name)}
  onClose={() => setModalOpen(false)}
  onSuccess={handleSaveExpert}
/>
```

- [ ] **Step 5: 提交 ExpertCenter 改动**

```bash
git add apps/web/src/components/expert/ExpertCenter.tsx
git commit -m "feat(expert): ExpertCenter 使用 categories API 并添加未分类 Tab"
```

---

### Task 9: 修改 ExpertForm 使用 categories API

**Files:**
- Modify: `apps/web/src/components/expert/ExpertForm.tsx`

这个文件不需要修改，因为它接收的 `categories` 已经是字符串数组，由 ExpertCenter 传入。

---

### Task 10: 修改后端 experts API 支持未分类查询

**Files:**
- Modify: `apps/server/src/routes/experts.ts`

- [ ] **Step 1: 修改 experts 列表查询支持 category=null**

```typescript
  // List experts (optionally filtered by category)
  fastify.get<{
    Querystring: { category?: string };
  }>('/experts', async (request, reply) => {
    const { category } = request.query;

    let sql = 'SELECT * FROM experts WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (category === 'null') {
      // Filter for uncategorized experts
      sql += ' AND category IS NULL';
    } else if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_default DESC, name ASC';

    const rows = all<ExpertRow>(sql, params);
    return {
      success: true,
      data: rows.map(rowToExpert),
    };
  });
```

- [ ] **Step 2: 提交后端改动**

```bash
git add apps/server/src/routes/experts.ts
git commit -m "feat(api): experts API 支持查询未分类专家 (category=null)"
```

---

## 验收清单

- [ ] 侧边栏显示「设置 > 分类管理」入口
- [ ] 分类管理页面显示所有分类列表
- [ ] 可以新增分类
- [ ] 可以编辑分类名称和描述
- [ ] 删除分类时需要二次确认
- [ ] 删除分类后，该分类下的专家变为「未分类」
- [ ] 专家中心显示「未分类」Tab（有未分类专家时）
- [ ] 新增/编辑专家时，分类选择器显示所有分类

---

## 最终提交

```bash
git add -A
git commit -m "feat: 完成专家分类管理功能

- 新增独立的 categories 表和 CRUD API
- 新增分类管理页面 /settings/categories
- 专家中心支持显示未分类专家
- 删除分类时专家自动变为未分类

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
