# 示例 Markdown 文件格式

## 这是应用生成的 Markdown 文件示例

---
id: "550e8400-e29b-41d4-a716-446655440000"
title: "示例笔记页面"
type: "note"
created: "2025-01-20T10:00:00.000Z"
updated: "2025-01-20T15:30:00.000Z"
---

- 这是一个顶层块 ^block-001
  - 这是第一个子块 ^block-002
  - 这是第二个子块 ^block-003
    - 这是更深层的块 ^block-004
- 另一个顶层块 ^block-005
- 包含双向链接的块：参见 [[其他页面]] 了解更多 ^block-006
- 多行内容的块： ^block-007
  这是第二行
  这是第三行
- 支持 Markdown 语法的块： ^block-008
  **粗体** *斜体* `代码` [链接](https://example.com)

## 格式说明

### YAML Frontmatter

```yaml
---
id: "uuid"              # 页面唯一 ID
title: "页面标题"       # 页面标题
type: "note"            # note 或 daily
created: "ISO 8601"     # 创建时间
updated: "ISO 8601"     # 更新时间
---
```

### 块格式

- 每个块以 `- ` 开头（列表项）
- 子块通过缩进表示（2 空格 = 1 级）
- 块 ID 在行尾：`^block-id`
- 支持多行内容

### 双向链接

- 格式：`[[页面标题]]`
- 自动创建目标页面
- 点击可跳转

### 层级结构

```
- 顶层块 (level 0)
  - 子块 (level 1)
    - 孙块 (level 2)
      - 曾孙块 (level 3)
```

## 兼容性说明

### 与 Obsidian 的兼容性

✅ 完全兼容：
- Markdown 基本语法
- 双向链接 `[[]]`
- YAML frontmatter

⚠️ 部分兼容：
- 块引用（格式略有不同）
- 标签（Obsidian 使用 `#tag`）
- 元数据字段可能不同

### 与 Logseq 的兼容性

✅ 完全兼容：
- 列表式块结构
- pages/ 和 journals/ 目录
- 块 ID 标记

⚠️ 部分兼容：
- 块属性语法不同
- 缩进处理略有差异

## 最佳实践

1. **保持简单**：不要过度使用嵌套（3-4 层足够）
2. **清晰的标题**：使用有意义的页面标题
3. **合理链接**：不要过度链接，只链接相关页面
4. **定期备份**：使用 Git 或云同步

## 手动编辑指南

如果你想手动创建或编辑 Markdown 文件：

### 创建新页面

1. 在 `pages/` 目录创建 `.md` 文件
2. 添加 frontmatter（可选，应用会自动添加）
3. 使用列表格式编写内容
4. 保存文件
5. 应用会在 5 秒内自动导入

### 编辑现有页面

1. 用任何编辑器打开 `.md` 文件
2. 编辑内容（保持列表格式）
3. 不要修改块 ID（除非你知道你在做什么）
4. 保存文件
5. 应用会自动更新

### 注意事项

- ⚠️ 不要删除 frontmatter
- ⚠️ 保持块 ID 唯一性
- ⚠️ 使用 2 空格缩进（不要用 Tab）
- ⚠️ 块 ID 必须在行尾

## 示例文件

### 日记文件（journals/2025-01-20.md）

```markdown
---
id: "daily-20250120"
title: "2025-01-20"
type: "daily"
created: "2025-01-20T00:00:00.000Z"
updated: "2025-01-20T23:59:00.000Z"
---

- 今天完成的事情 ^block-101
  - 完成了项目 A 的设计稿 ^block-102
  - 学习了 TypeScript 高级类型 ^block-103
- 明天计划 ^block-104
  - 开发新功能 ^block-105
  - 参加团队会议 ^block-106
- 随笔 ^block-107
  今天天气不错，心情也很好
```

### 项目笔记（pages/项目A.md）

```markdown
---
id: "project-a"
title: "项目 A"
type: "note"
created: "2025-01-15T10:00:00.000Z"
updated: "2025-01-20T15:00:00.000Z"
---

- 项目概述 ^block-201
  项目 A 是一个创新的 Web 应用
- 技术栈 ^block-202
  - 前端：React + TypeScript ^block-203
  - 后端：Node.js + Express ^block-204
  - 数据库：PostgreSQL ^block-205
- 进度跟踪 ^block-206
  - [x] 需求分析 ^block-207
  - [x] 原型设计 ^block-208
  - [ ] 开发实现 ^block-209
  - [ ] 测试部署 ^block-210
- 相关文档 ^block-211
  参见 [[技术文档]] 和 [[设计规范]]
```

## 🎓 下一步

- 📖 阅读 [FILE_SYSTEM_STORAGE.md](./FILE_SYSTEM_STORAGE.md) 了解详细功能
- 🔧 探索开发者工具（打开控制台输入 `devTools`）
- 💬 使用 AI 助手帮助整理笔记
- 🔗 使用双向链接构建知识网络

---

**Happy Note-Taking! 📝**

