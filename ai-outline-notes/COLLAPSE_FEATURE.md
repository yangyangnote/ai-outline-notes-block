# 折叠/展开功能实现文档

## 🎯 功能概述

类似 Logseq 的折叠/展开功能，可以随时收起/展开子块，并且状态会持久化保存。

## ✅ 已实现的功能

### 1. 数据结构更新

在 `Block` 类型中添加了 `collapsed` 字段：

```typescript
export interface Block {
  id: string;
  content: string;
  parentId: string | null;
  pageId: string;
  order: number;
  collapsed: boolean;  // ✅ 新增：是否折叠子块
  createdAt: number;
  updatedAt: number;
}
```

### 2. 数据库更新

- 在 IndexedDB 中添加了 `collapsed` 字段的索引
- 所有创建的块默认 `collapsed: false`（展开状态）
- 状态自动持久化到 IndexedDB

### 3. UI 组件

#### 折叠/展开按钮
- 在每个块的左侧显示箭头按钮
- 只有包含子块的块才显示按钮
- 箭头图标：
  - **▶️ ChevronRight**：折叠状态（子块被隐藏）
  - **▼ ChevronDown**：展开状态（子块可见）

#### 视觉效果
- 点击箭头切换状态
- 鼠标悬停显示提示文字
- 平滑的过渡动画

### 4. 核心逻辑

#### `toggleBlockCollapse` 函数
```typescript
export async function toggleBlockCollapse(blockId: string): Promise<void> {
  const block = await db.blocks.get(blockId);
  if (!block) return;
  
  await db.blocks.update(blockId, {
    collapsed: !block.collapsed,
    updatedAt: Date.now(),
  });
}
```

#### 渲染逻辑（`buildFlatTree`）
```typescript
const addBlockWithChildren = (block: Block) => {
  result.push(block);
  
  // 如果块被折叠，不添加子块
  if (block.collapsed) {
    return;
  }
  
  // 展开状态下，递归添加子块
  const children = blocks
    .filter(b => b.parentId === block.id)
    .sort((a, b) => a.order - b.order);
  
  children.forEach(addBlockWithChildren);
};
```

## 🎨 使用示例

### 创建层级结构

```
主题块
    子块 1
        孙块 1-1
        孙块 1-2
    子块 2
```

### 折叠操作

1. **点击主题块前的箭头** → 折叠所有子块
2. **状态变化**：
   - 箭头从 ▼ 变为 ▶️
   - 所有子块（包括孙块）消失
3. **再次点击** → 展开所有子块

### 状态持久化

- 折叠状态保存在 IndexedDB
- 刷新页面后状态保持
- 切换页面后再回来，状态不变

## 🔧 实现细节

### 1. 检测块是否有子块

```typescript
const hasChildren = (blockId: string): boolean => {
  return blocks.some(b => b.parentId === blockId);
};
```

### 2. 按钮渲染条件

```typescript
{hasChildren ? (
  <button onClick={() => onToggleCollapse(block.id)}>
    {block.collapsed ? <ChevronRight /> : <ChevronDown />}
  </button>
) : (
  <div className="w-5 h-5" /> // 占位符，保持对齐
)}
```

### 3. 过滤被折叠的子块

在 `buildFlatTree` 函数中：
- 如果父块 `collapsed: true`，跳过添加子块
- 递归停止，保持树的展平结构

## 📝 与 Logseq 的对比

| 功能 | Logseq | 本应用 | 状态 |
|------|--------|--------|------|
| 折叠/展开按钮 | ✅ | ✅ | 已实现 |
| 状态持久化 | ✅ | ✅ | 已实现 |
| 箭头图标 | ✅ | ✅ | 已实现 |
| 键盘快捷键 | ✅ | ❌ | 待实现 |
| 全部折叠/展开 | ✅ | ❌ | 待实现 |
| 折叠层级显示 | ✅ | ❌ | 待实现 |

## 🚀 后续增强

### 1. 键盘快捷键（推荐）

```typescript
// Cmd/Ctrl + . 切换折叠
if ((e.metaKey || e.ctrlKey) && e.key === '.') {
  e.preventDefault();
  onToggleCollapse(block.id);
}
```

### 2. 全部折叠/展开

```typescript
// 折叠所有顶层块
export async function collapseAll(pageId: string): Promise<void> {
  const blocks = await db.blocks.where({ pageId }).toArray();
  const topLevel = blocks.filter(b => !b.parentId);
  
  for (const block of topLevel) {
    await db.blocks.update(block.id, { collapsed: true });
  }
}
```

### 3. 显示折叠数量

```typescript
// 在折叠图标旁显示子块数量
const childCount = blocks.filter(b => b.parentId === block.id).length;

{block.collapsed && (
  <span className="text-xs text-gray-500 ml-1">
    ({childCount})
  </span>
)}
```

### 4. 动画效果

```typescript
// 使用 Framer Motion 添加展开/折叠动画
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.2 }}
>
  {children}
</motion.div>
```

## 🎯 使用技巧

### 1. 组织大纲

```
项目计划 ▶️  (折叠)
    阶段一 (隐藏)
        任务 1-1
        任务 1-2
    阶段二
```

### 2. 聚焦内容

- 折叠不相关的部分
- 只展开当前工作的部分
- 保持页面整洁

### 3. 层级导航

- 顶层折叠 = 章节概览
- 逐层展开 = 深入细节

## 🐛 已知限制

1. **无键盘快捷键**：暂时只能点击鼠标
2. **无批量操作**：不能一键折叠/展开全部
3. **无折叠指示器**：折叠后看不到子块数量

## 🔄 数据库迁移

如果你的应用已有旧数据，需要迁移：

```typescript
// 一次性迁移脚本
async function migrateOldBlocks() {
  const blocks = await db.blocks.toArray();
  for (const block of blocks) {
    if (block.collapsed === undefined) {
      await db.blocks.update(block.id, { collapsed: false });
    }
  }
}
```

## ✅ 测试清单

- [x] 创建父子块结构
- [x] 点击箭头折叠子块
- [x] 折叠状态图标正确显示
- [x] 刷新页面状态保持
- [x] 再次点击展开子块
- [x] 没有子块的块不显示箭头
- [x] 数据库正确保存 collapsed 字段

---

**实现日期**：2025-10-13  
**版本**：MVP v0.2  
**状态**：✅ 已完成并测试



