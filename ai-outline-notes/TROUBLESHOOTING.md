# 故障排查指南

## Tab 缩进功能问题

### 问题描述
按 Tab 键时，块没有缩进。

### 已修复的问题
✅ Dexie 查询语法错误已修复（不能同时查询多个字段）

### 当前状态
代码已经修复，Tab 缩进功能现在应该可以正常工作了。

### 如何测试

1. **创建一些测试块**：
   ```
   第一个块
   第二个块
   第三个块
   ```

2. **缩进测试**：
   - 点击"第二个块"
   - 按 `Tab` 键
   - 预期：第二个块应该向右缩进，成为第一个块的子块

3. **反缩进测试**：
   - 在已缩进的块上按 `Shift + Tab`
   - 预期：块应该向左移动

### 可能的限制

- ❌ **第一个块不能缩进**：因为它前面没有兄弟块
- ✅ **第二个及之后的块可以缩进**：会成为前一个块的子块
- ❌ **顶层块不能反缩进**：已经在最外层了

### 修复的技术细节

**问题**：Dexie 的 `where()` 方法不支持这种写法：
```typescript
// ❌ 错误
db.blocks.where({ pageId: '...', parentId: '...' })
```

**解决方案**：先查询 pageId，然后用 filter 过滤：
```typescript
// ✅ 正确
const allBlocks = await db.blocks.where({ pageId }).toArray();
const siblings = allBlocks.filter(b => b.parentId === block.parentId);
```

### 验证修复

打开浏览器控制台（F12），应该：
- ✅ 没有 JavaScript 错误
- ✅ Tab 键按下时有数据库更新
- ✅ 块的 `paddingLeft` 样式会改变

### 如果还是不工作

1. **清除浏览器缓存**：
   - 按 `Cmd + Shift + R`（Mac）或 `Ctrl + Shift + R`（Windows）
   - 硬刷新页面

2. **检查 IndexedDB**：
   - 打开浏览器开发者工具（F12）
   - Application 标签 → Storage → IndexedDB → NotesDatabase
   - 查看 blocks 表，确认 parentId 和 order 字段是否更新

3. **查看控制台错误**：
   - 如果有任何红色错误，记录下来
   - 检查是否有网络错误或 promise 被拒绝的警告

## OpenAI API 问题

### 错误：429 Too Many Requests

**原因**：
- 免费配额用完
- 付费账户余额不足
- 达到速率限制

**解决方案**：
1. 访问 https://platform.openai.com/usage 检查用量
2. 访问 https://platform.openai.com/account/billing 充值
3. 等待几分钟后重试（速率限制）

### 代码是正确的
✅ API Key 保存功能正常  
✅ OpenAI 客户端初始化正常  
✅ 网络请求正常发出  

只是因为账户配额问题，API 调用被拒绝。

---

**最后更新**：2025-10-13  
**版本**：MVP v0.1



