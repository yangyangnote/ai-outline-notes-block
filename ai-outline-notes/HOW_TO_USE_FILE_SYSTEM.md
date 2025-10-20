# 文件系统存储 - 使用说明

## 🎬 快速演示（3 分钟）

### 第一次使用

```bash
# 1. 启动应用
npm run dev

# 2. 浏览器会打开 http://localhost:5173
# 3. 你会看到欢迎界面
```

**界面上的操作**：
1. 点击 "选择笔记文件夹" 按钮
2. 选择一个空文件夹（或创建新文件夹，如 `MyNotes`）
3. 授予读写权限
4. 等待几秒，应用自动初始化

**完成！**现在你可以：
- ✅ 在应用中编辑笔记
- ✅ 笔记自动保存为 .md 文件
- ✅ 用任何编辑器打开文件夹

---

## 📂 打开你的笔记文件夹

用文件管理器打开你选择的文件夹，你会看到：

```
MyNotes/
├── .notesdb/
│   └── config.json          # ← 应用配置（自动生成）
├── pages/
│   └── 欢迎使用-AI-大纲笔记.md  # ← 你的第一篇笔记！
└── journals/
    └── (空)                  # ← 日记会保存在这里
```

**打开 `pages/欢迎使用-AI-大纲笔记.md`**，你会看到：

```markdown
---
id: "uuid-here"
title: "欢迎使用 AI 大纲笔记"
type: "note"
created: "2025-01-20T10:00:00.000Z"
updated: "2025-01-20T10:00:00.000Z"
---

- # 欢迎使用 AI 大纲笔记 👋 ^block-id-1
- 这是一个结合了大纲笔记和 AI 助手的应用 ^block-id-2
- ## 快速开始 ^block-id-3
- 使用 **Tab** 缩进，**Shift+Tab** 反缩进 ^block-id-4
...
```

---

## 💡 使用场景

### 场景 1：日常笔记

**在应用中**：
1. 点击 "今日日记"
2. 记录今天的想法
3. 使用 Tab 组织结构

**查看文件**：
```
journals/2025-01-20.md  ← 今天的日记
```

### 场景 2：项目管理

**创建项目笔记**：
1. 新建页面："项目 A"
2. 添加内容：
   ```
   - 项目概述
     - 目标和愿景
   - 技术栈
     - 前端
     - 后端
   - 进度跟踪
   ```

**文件自动创建**：
```
pages/项目-A.md  ← Markdown 文件
```

### 场景 3：知识库

**构建知识网络**：
1. 创建多个相关笔记
2. 使用 `[[链接]]` 互相引用
3. 查看反向链接

**文件结构**：
```
pages/
├── React.md
├── TypeScript.md
├── Web-开发.md
└── 前端框架对比.md
```

每个文件都包含到其他文件的链接。

---

## 🔄 双向编辑演示

### 在应用中编辑

1. 在应用中编辑 "项目 A"
2. 添加一行："- 新增功能需求"
3. **自动保存**（100ms 后）

### 用 VS Code 编辑

1. 打开 VS Code
2. File → Open Folder → 选择你的 vault
3. 编辑 `pages/项目-A.md`
4. 添加一行："- 另一个需求"
5. 保存文件（Cmd/Ctrl + S）
6. **5 秒内**，应用自动显示新内容

### 验证同步

切换回应用，你会看到两处修改都在：
```
- 新增功能需求          ← 应用中添加的
- 另一个需求            ← VS Code 中添加的
```

---

## ⚙️ 控制台命令

打开浏览器控制台（F12），输入：

```javascript
// 📊 查看统计
devTools.stats()
// 输出：
// 📊 数据库统计信息：
//   - 页面数量: 5
//   - 块数量: 23
//   - 对话数量: 2
//   - 总大小: 约 3 KB

// 🔄 手动同步
const sync = getSyncEngine()
sync.fullSync()

// 📤 迁移到文件系统
devTools.migrateToFiles()

// 📥 从文件系统导入
devTools.importFromFiles()

// 💾 导出 JSON 备份
devTools.export()
```

---

## 🛠️ 常见操作

### 切换笔记库

1. 点击侧边栏底部的 ⚙️ 图标
2. 选择 "切换笔记库"
3. 确认
4. 选择新的文件夹

### 备份数据

**方法 1：复制文件夹**
```bash
cp -r ~/MyNotes ~/Backups/MyNotes-20250120
```

**方法 2：云同步**
```
将 MyNotes 移动到：
- macOS: ~/Library/Mobile Documents/com~apple~CloudDocs/
- Windows: ~/OneDrive/
- 通用: ~/Dropbox/
```

**方法 3：Git**
```bash
cd ~/MyNotes
git init
git add .
git commit -m "Backup $(date +%Y%m%d)"
```

### 迁移到其他应用

**导出到 Obsidian**：
1. 你的 vault 已经是 Markdown 格式
2. 直接在 Obsidian 中打开这个文件夹
3. 所有双向链接都能正常工作

**导出到 Logseq**：
1. 将 `pages/` 和 `journals/` 复制到 Logseq 文件夹
2. 重启 Logseq
3. 笔记会自动导入

---

## 📱 实际使用建议

### Do ✅

- ✅ 将 vault 放在云同步文件夹
- ✅ 使用 Git 版本控制
- ✅ 定期检查 .md 文件完整性
- ✅ 使用双向链接构建知识网络
- ✅ 保持笔记简洁有序

### Don't ❌

- ❌ 同时在多个编辑器中编辑同一文件
- ❌ 手动修改 frontmatter 中的 ID
- ❌ 删除或重命名 .notesdb/ 目录
- ❌ 在 vault 中放置非 Markdown 文件
- ❌ 使用特殊字符命名文件

---

## 🎓 学习路径

### 初学者（第 1 天）

- [ ] 启动应用，选择文件夹
- [ ] 创建第一篇笔记
- [ ] 查看生成的 .md 文件
- [ ] 理解文件结构

### 进阶（第 1 周）

- [ ] 使用双向链接 `[[]]`
- [ ] 尝试外部编辑器编辑
- [ ] 设置云同步
- [ ] 探索开发者工具

### 高级（第 1 月）

- [ ] 设置 Git 版本控制
- [ ] 与 Obsidian/Logseq 互操作
- [ ] 自定义 Markdown 格式
- [ ] 开发自动化脚本

---

## 💬 获取帮助

### 文档

- [FILE_SYSTEM_STORAGE.md](./FILE_SYSTEM_STORAGE.md) - 完整功能文档
- [FILE_SYSTEM_QUICKSTART.md](./FILE_SYSTEM_QUICKSTART.md) - 快速上手
- [docs/EXAMPLE_MARKDOWN.md](./docs/EXAMPLE_MARKDOWN.md) - Markdown 示例

### 常见问题

**Q: 数据安全吗？**  
A: 是的。数据完全存储在你的本地文件夹，应用无法访问其他文件。

**Q: 可以导入现有笔记吗？**  
A: 可以。选择包含 .md 文件的文件夹，应用会自动导入。

**Q: 如何备份？**  
A: 直接复制整个文件夹，或使用云同步/Git。

**Q: 支持移动端吗？**  
A: 当前不支持。移动浏览器不支持 File System Access API。

**Q: 可以离线使用吗？**  
A: 可以。所有功能都是本地的，只有 AI 助手需要网络。

---

**开始探索你的本地优先笔记之旅吧！** 🚀

