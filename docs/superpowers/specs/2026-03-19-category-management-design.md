# 专家分类管理设计

## 概述

新增独立的专家分类管理功能，支持新增、编辑、删除分类。分类与专家解耦，可存在空分类。

## 需求

1. 分类独立于专家存在，有自己的属性
2. 支持新增、编辑、删除分类
3. 删除分类时，关联专家自动变为「未分类」
4. 专家中心显示「未分类」Tab 供未分类专家展示
5. 分类管理入口在独立的设置页面

## 技术方案

### 数据模型

#### 新增 categories 表

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,           -- cat_xxxx 格式
  name TEXT NOT NULL UNIQUE,     -- 分类名称
  description TEXT,              -- 分类描述
  sort_order INTEGER DEFAULT 0,  -- 排序顺序（小的在前）
  created_at TEXT,
  updated_at TEXT
);
```

#### 修改 experts 表

- `category` 字段改为外键关联（允许 NULL，表示未分类）

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/categories` | 获取所有分类（按 sort_order 排序） |
| POST | `/categories` | 新增分类 |
| PUT | `/categories/:id` | 更新分类 |
| DELETE | `/categories/:id` | 删除分类（关联专家的 category 置空） |

### 组件结构

```
apps/web/src/
├── app/settings/
│   └── categories/
│       └── page.tsx           # 分类管理页面
├── components/category/
│   ├── CategoryList.tsx       # 分类列表表格
│   ├── CategoryModal.tsx      # 新增/编辑模态框
│   └── CategoryForm.tsx       # 分类表单（复用）
```

## 详细设计

### 1. CategoryList 组件

表格展示所有分类，列包含：
- 名称
- 描述
- 专家数量（从 experts 表统计）
- 操作按钮（编辑、删除）

### 2. CategoryModal 组件

**Props:**
```typescript
interface CategoryModalProps {
  mode: 'create' | 'edit';
  category?: Category;  // edit 模式必填
  open: boolean;
  onClose: () => void;
  onSuccess: (category: Category) => void;
}
```

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | text | ✅ | 分类名称 |
| description | textarea | ❌ | 分类描述 |

### 3. CategoryForm 组件

**Props:**
```typescript
interface CategoryFormProps {
  value: Partial<Category>;
  onChange: (updates: Partial<Category>) => void;
}
```

### 4. 删除确认逻辑

```typescript
// 删除分类时
const handleDelete = async (id: string) => {
  // 1. 后端 DELETE /categories/:id
  // 2. 后端自动将该分类下专家的 category 置空
  // 3. 前端刷新分类列表
};
```

### 5. ExpertCenter 改动

- 分类 Tab 数据源从 `/categories` API 获取
- 新增「未分类」Tab，当存在未分类专家时显示
- Tab 显示格式：`[全部] [技术(5)] [金融(3)] [未分类(2)]`

### 6. ExpertForm 改动

- 分类选择器从 `/categories` API 获取选项
- 必须选择一个分类（不允许为空）

### 7. 侧边栏改动

新增「设置」分组：

```
├── 💬 对话
├── 🤖 专家中心
├── ────────
├── ⚙️ 设置
│   └── 📁 分类管理
```

## 数据流

```
[新增分类]
CategoryModal 保存 → POST /api/v1/categories → 刷新分类列表

[编辑分类]
CategoryModal 保存 → PUT /api/v1/categories/:id → 更新本地状态

[删除分类]
确认对话框 → DELETE /api/v1/categories/:id
           → 后端将该分类下专家的 category 置空
           → 刷新分类列表
```

## UI 设计

### 分类管理页面

```
┌─────────────────────────────────────────────────────────┐
│  分类管理                                [ + 新增分类 ]  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │ 名称          │ 描述           │ 专家数 │ 操作     ││
│  ├─────────────────────────────────────────────────────┤│
│  │ 技术          │ 技术类专家     │   5    │ ✏️ 🗑️   ││
│  │ 金融          │ 金融投资顾问   │   3    │ ✏️ 🗑️   ││
│  │ 医疗          │ -              │   0    │ ✏️ 🗑️   ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### CategoryModal 布局

```
┌─────────────────────────────────────┐
│  新增分类                      [×]  │
├─────────────────────────────────────┤
│  名称 *       [_________________]   │
│  描述         [_________________]   │
│              [_________________]   │
├─────────────────────────────────────┤
│                  [取消]    [保存]   │
└─────────────────────────────────────┘
```

### 专家中心分类 Tab

```
[全部] [技术(5)] [金融(3)] [医疗(0)] [未分类(2)]
```

### 设计规范

| 元素 | 样式 |
|------|------|
| 页面背景 | `bg-neutral-900` |
| 表格背景 | `bg-neutral-800` |
| 边框 | `border-neutral-700` |
| 主按钮 | `bg-primary-600 hover:bg-primary-700` |
| 次按钮 | `bg-neutral-700 hover:bg-neutral-600` |
| 圆角 | `rounded-lg` |

## 文件变更清单

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `routes/categories.ts` | 新增 | 分类 CRUD API |
| `routes/experts.ts` | 修改 | category 关联逻辑 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/settings/categories/page.tsx` | 新增 | 分类管理页面 |
| `components/category/CategoryList.tsx` | 新增 | 分类列表表格 |
| `components/category/CategoryModal.tsx` | 新增 | 新增/编辑模态框 |
| `components/category/CategoryForm.tsx` | 新增 | 分类表单组件 |
| `components/layout/Sidebar.tsx` | 修改 | 添加设置入口 |
| `components/expert/ExpertCenter.tsx` | 修改 | Tab 数据源改动 |
| `components/expert/ExpertForm.tsx` | 修改 | 分类选择器 |

## 实现顺序

1. **数据库** - 创建 categories 表，修改 experts 表
2. **后端 API** - 实现分类 CRUD，修改删除逻辑
3. **前端组件** - CategoryForm → CategoryModal → CategoryList
4. **页面集成** - 分类管理页面
5. **侧边栏** - 添加设置入口
6. **专家中心** - 改动 Tab 数据源和 ExpertForm

## 验收标准

- [ ] 侧边栏显示「设置 > 分类管理」入口
- [ ] 分类管理页面显示所有分类列表
- [ ] 可以新增分类
- [ ] 可以编辑分类名称和描述
- [ ] 删除分类时弹出确认对话框
- [ ] 删除分类后，该分类下的专家变为「未分类」
- [ ] 专家中心显示「未分类」Tab（有未分类专家时）
- [ ] 新增/编辑专家时，分类选择器显示所有分类
