# 文件系统存储 - 快速开始

## 🚀 5分钟上手指南

### 步骤 1: 启动应用

```bash
cd ai-outline-notes
npm run dev
```

访问 http://localhost:5173

### 步骤 2: 选择笔记文件夹

首次启动时，你会看到 Vault 选择界面：

1. 点击 **"选择笔记文件夹"** 按钮
2. 在文件选择器中：
   - 创建一个新文件夹（如 `MyNotes`）
   - 或选择现有的空文件夹
3. 授予读写权限
4. 应用会自动创建以下结构：

```
MyNotes/
├── .notesdb/         # 元数据（自动）
├── pages/            # 你的笔记
└── journals/         # 日记
```

### 步骤 3: 开始使用

选择文件夹后，应用会：
- ✅ 自动同步现有 Markdown 文件（如果有）
- ✅ 创建欢迎页面
- ✅ 开始实时监听文件变更

现在你可以：
- 📝 在应用中编辑笔记
- 💾 自动保存为 Markdown 文件
- 📂 用 VS Code / Sublime / Typora 等编辑器打开文件夹
- 🔄 文件变更会自动同步回应用

## 💡 使用示例

### 示例 1: 创建笔记并查看文件

1. 在应用中点击 "新建页面"
2. 输入标题："我的第一篇笔记"
3. 编辑内容：
   ```
   - 这是第一个要点
     - 这是子要点
   - 这是第二个要点
   - 链接到 [[另一个页面]]
   ```
4. 打开文件夹 `MyNotes/pages/`
5. 你会看到 `我的第一篇笔记.md` 文件

### 示例 2: 用外部编辑器编辑

1. 用 VS Code 打开 `MyNotes` 文件夹
2. 编辑任何 `.md` 文件
3. 保存文件
4. 5 秒内，应用会自动刷新显示新内容

### 示例 3: 导入现有 Markdown 笔记

如果你有现有的 Markdown 文件：

1. 将它们复制到 `MyNotes/pages/` 文件夹
2. 文件会自动被导入
3. 如果文件没有 frontmatter，应用会自动添加

### 示例 4: 云同步备份

将笔记文件夹放在云同步文件夹中：

```bash
# macOS iCloud
MyNotes -> ~/Library/Mobile Documents/com~apple~CloudDocs/MyNotes

# Dropbox
MyNotes -> ~/Dropbox/MyNotes

# OneDrive
MyNotes -> ~/OneDrive/MyNotes
```

现在你的笔记会自动同步到所有设备！

## 🎯 实际工作流

### 日常使用

**早上**：
1. 打开应用
2. 点击 "今日日记"
3. 记录今天的计划和想法

**工作中**：
- 随时记录要点
- 使用 `[[项目名]]` 链接相关笔记
- Tab/Shift+Tab 组织结构

**晚上**：
- 回顾今天的笔记
- 整理重要内容
- 数据已自动保存到文件系统

### 多设备协作

1. 将 `MyNotes` 放在 iCloud/Dropbox
2. 在另一台电脑上：
   - 启动应用
   - 选择同步后的文件夹
   - 自动导入所有笔记
3. 两台设备通过云同步保持一致

### 版本控制（高级）

使用 Git 管理笔记历史：

```bash
cd MyNotes
git init
git add .
git commit -m "Initial commit"

# 每次重要更新
git add .
git commit -m "Update notes"

# 查看历史
git log
git diff
```

## 🔧 开发者功能

### 控制台命令

```javascript
// 查看统计
devTools.stats()

// 迁移现有 IndexedDB 数据到文件系统
devTools.migrateToFiles()

// 从文件系统重新导入
devTools.importFromFiles()

// 导出 JSON 备份
devTools.export()
```

### 自定义文件格式

你可以手动编辑 Markdown 文件，只需：
- 保持 frontmatter 格式
- 使用 `- ` 开头表示块
- 使用空格缩进表示层级（2 空格 = 1 级）
- 块 ID 可选（应用会自动添加）

## ❓ 常见问题

**Q: 如何在应用和 VS Code 之间切换编辑？**
```
1. 在应用中编辑 → 自动保存到文件
2. 在 VS Code 中编辑 → 保存后 5 秒内应用自动更新
3. 两者可以同时打开，互不干扰
```

**Q: 如果两边同时编辑怎么办？**
```
默认：文件优先（外部编辑会覆盖应用编辑）
建议：同一时间只在一处编辑
```

**Q: 可以用 Obsidian/Logseq 打开吗？**
```
可以！格式基本兼容。
注意：某些高级功能（如块属性）可能不完全一致。
```

**Q: 数据会丢失吗？**
```
不会。数据存储在本地文件系统，除非你手动删除文件。
建议：使用云同步或 Git 进行额外备份。
```

## 🎨 进阶技巧

### 技巧 1: 模板系统

在 `pages/` 创建模板文件：

```markdown
---
id: "template-meeting"
title: "会议记录模板"
type: "note"
---

- 会议时间：
- 参与人员：
- 讨论议题：
  - 议题1
  - 议题2
- 行动项：
  - [ ] 待办1
  - [ ] 待办2
```

需要时复制并重命名文件。

### 技巧 2: 文件夹书签

将常用笔记文件夹添加到：
- macOS Finder 侧边栏
- Windows 快速访问
- VS Code 工作区

### 技巧 3: 自动化

使用脚本自动处理笔记：

```bash
#!/bin/bash
# 每日备份脚本
cd ~/MyNotes
tar -czf ~/Backups/notes-$(date +%Y%m%d).tar.gz .
```

---

**开始享受本地优先的笔记体验吧！** 🎉

