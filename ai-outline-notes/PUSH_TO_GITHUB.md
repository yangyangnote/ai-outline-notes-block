# 📤 推送到 GitHub 指南

## ✅ 已完成

- [x] Git 仓库初始化
- [x] 所有文件已暂存
- [x] 第一个提交已创建（commit 7b0a97c）
  - 39 个文件
  - 10377 行代码
  - 包含所有功能和文档

## 🚀 推送到 GitHub（3 步）

### 步骤 1：在 GitHub 上创建仓库

1. **访问 GitHub**
   - 打开 https://github.com/new

2. **填写仓库信息**
   - Repository name: `ai-outline-notes`
   - Description: `AI 大纲笔记 - 结合大纲笔记和 AI 助手的现代化笔记应用`
   - 选择 **Private**（私有仓库，暂时不公开）
   - ❌ **不要**勾选 "Add a README file"
   - ❌ **不要**勾选 "Add .gitignore"
   - ❌ **不要**勾选 "Choose a license"

3. **点击 "Create repository"**

4. **复制仓库 URL**
   - 会显示类似：`git@github.com:你的用户名/ai-outline-notes.git`
   - 或者：`https://github.com/你的用户名/ai-outline-notes.git`

### 步骤 2：添加远程仓库

在终端运行（替换成你的仓库 URL）：

```bash
cd /Users/mac/笔记📒/ai-outline-notes

# 使用 HTTPS（简单，推荐）
git remote add origin https://github.com/你的用户名/ai-outline-notes.git

# 或者使用 SSH（需要配置 SSH Key）
git remote add origin git@github.com:你的用户名/ai-outline-notes.git
```

### 步骤 3：推送代码

```bash
git push -u origin main
```

如果遇到认证问题，可能需要输入：
- GitHub 用户名
- Personal Access Token（不是密码）

---

## 📋 完整命令（复制粘贴）

假设你的 GitHub 用户名是 `yangyang`，运行以下命令：

```bash
cd /Users/mac/笔记📒/ai-outline-notes

# 1. 添加远程仓库（替换成你的用户名）
git remote add origin https://github.com/yangyang/ai-outline-notes.git

# 2. 推送到 GitHub
git push -u origin main
```

---

## 🔑 GitHub Personal Access Token

如果推送时提示需要密码，你需要创建 Personal Access Token：

### 创建 Token：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置：
   - Note: `ai-outline-notes`
   - Expiration: `90 days`
   - 勾选 scopes:
     - [x] `repo`（完整仓库访问权限）
4. 点击 "Generate token"
5. **复制 token**（只显示一次！）

### 使用 Token：

推送时：
- Username: 你的 GitHub 用户名
- Password: **粘贴刚才复制的 token**（不是密码！）

---

## 🎯 验证成功

推送成功后，你可以：

1. **访问 GitHub 仓库页面**
   ```
   https://github.com/你的用户名/ai-outline-notes
   ```

2. **看到所有文件和提交记录**
   - 39 个文件
   - 第一个提交："🎉 Initial commit..."

3. **仓库会显示 README.md**
   - GitHub 自动渲染项目说明

---

## 📝 后续 Git 工作流

### 日常开发

每次做了修改后：

```bash
# 查看修改
git status

# 添加所有修改
git add .

# 创建提交
git commit -m "feat: 添加某某功能"

# 推送到 GitHub
git push
```

### 提交信息规范

```bash
# 新功能
git commit -m "feat: 添加双向链接功能"

# 修复 bug
git commit -m "fix: 修复 Tab 缩进问题"

# 文档更新
git commit -m "docs: 更新 README"

# 性能优化
git commit -m "perf: 优化大量块时的渲染性能"
```

---

## 🔒 .gitignore 已配置

以下文件/文件夹不会被提交：

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

这些是自动生成的或包含敏感信息的文件。

---

## 🎁 推荐的 README Badge

推送成功后，可以在 README.md 顶部添加徽章：

```markdown
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![License](https://img.shields.io/badge/license-MIT-green)
```

---

## ❓ 常见问题

### Q: remote origin already exists
**解决**：
```bash
git remote remove origin
git remote add origin https://github.com/你的用户名/ai-outline-notes.git
```

### Q: ! [rejected] main -> main (fetch first)
**解决**：
```bash
git pull origin main --rebase
git push origin main
```

### Q: Permission denied (publickey)
**解决**：改用 HTTPS 而不是 SSH
```bash
git remote set-url origin https://github.com/你的用户名/ai-outline-notes.git
```

---

## 🎯 准备好了吗？

请按照上面的步骤操作：

1. ✅ **Git 提交已完成**
2. ⏳ **去 GitHub 创建仓库** → https://github.com/new
3. ⏳ **添加远程仓库** → `git remote add origin ...`
4. ⏳ **推送代码** → `git push -u origin main`

---

**需要帮助？告诉我你的 GitHub 用户名，我可以为你生成完整的命令！**

