# 数据清理指南

## 🔍 问题说明

你遇到的"每次打开页面都多一行"问题，主要原因是：

1. **React Strict Mode 双重渲染**
   - 开发模式下，React 会故意调用两次 useEffect 来帮助发现 bug
   - 导致 `initializeDatabase()` 被调用两次
   - 两次调用可能都检查到 `pageCount === 0`，于是创建了两个欢迎页面

2. **数据库版本升级**
   - 添加 `collapsed` 字段时，数据库结构改变
   - 旧数据可能与新结构不兼容

## ✅ 已修复的问题

### 1. 数据库版本管理 ✅
```typescript
// 版本 1 → 版本 2 自动升级
this.version(2).upgrade(async tx => {
  // 为旧数据添加 collapsed 字段
  const blocks = await tx.table('blocks').toArray();
  for (const block of blocks) {
    if (block.collapsed === undefined) {
      await tx.table('blocks').update(block.id, { collapsed: false });
    }
  }
});
```

### 2. 初始化锁 ✅
```typescript
// 防止并发初始化
let isInitializing = false;
let isInitialized = false;
```

### 3. 自动清理重复页面 ✅
每次启动应用时自动运行 `cleanupDuplicatePages()`

### 4. 防止重复创建空块 ✅
添加 `hasCreatedFirstBlock` 标志

## 🛠️ 立即清理数据

### 方法 1：使用开发工具（推荐）

1. **打开浏览器控制台**
   - 按 `F12` 或 `Cmd/Ctrl + Option + I`
   - 切换到 Console 标签

2. **查看数据库状态**
   ```javascript
   devTools.stats()
   ```
   会显示：页面数量、块数量、数据大小

3. **清理重复数据和空块**
   ```javascript
   devTools.cleanup()
   ```
   会自动：
   - 删除重复的欢迎页面
   - 删除所有空块
   - 刷新页面

4. **只删除空块**
   ```javascript
   devTools.deleteEmptyBlocks()
   ```

### 方法 2：手动清除（简单粗暴）

1. **打开控制台** (F12)
2. **运行命令**：
   ```javascript
   devTools.reset()
   ```
3. **确认清除**
4. **页面自动刷新**，重新初始化

### 方法 3：浏览器手动清除

1. **打开开发者工具** (F12)
2. **切换到 Application 标签**
3. **找到 Storage → IndexedDB → NotesDatabase**
4. **右键点击 → Delete Database**
5. **刷新页面**

## 📋 推荐操作流程

### 现在立即执行：

1. **打开 http://localhost:5173**
2. **打开控制台** (F12)
3. **运行**：
   ```javascript
   devTools.cleanup()
   ```
4. **等待页面自动刷新**
5. **开始使用干净的数据库**

### 以后使用：

现在已经修复了根本原因，不会再出现重复创建的问题：
- ✅ 初始化锁防止并发
- ✅ 自动清理重复页面
- ✅ 数据库版本正确升级
- ✅ 空块创建已控制

## 🎯 开发工具命令速查

| 命令 | 功能 | 安全性 |
|------|------|--------|
| `devTools.stats()` | 查看统计 | ✅ 安全 |
| `devTools.cleanup()` | 清理重复/空块 | ✅ 安全 |
| `devTools.deleteEmptyBlocks()` | 删除空块 | ✅ 安全 |
| `devTools.export()` | 导出备份 | ✅ 安全 |
| `devTools.reset()` | 清除所有数据 | ⚠️ 危险 |

## 🔄 数据恢复

如果你不小心删除了数据：

1. 检查是否有导出的备份文件
2. 控制台运行：
   ```javascript
   // 导入备份（待实现）
   ```

## 📝 后续改进

未来版本会添加：
- [ ] 图形界面的数据管理面板
- [ ] 自动备份功能
- [ ] 撤销/重做操作
- [ ] 数据导入界面

---

**立即行动**：打开控制台，运行 `devTools.cleanup()` 清理数据！



