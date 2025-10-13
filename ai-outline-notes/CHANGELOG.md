# 更新日志

## [v0.2.0] - 2025-10-13

### 🎉 新增功能

#### 折叠/展开功能
- ✅ 每个有子块的块左侧显示箭头按钮（▶️/▼）
- ✅ 点击箭头可折叠/展开子块
- ✅ 折叠状态自动保存到 IndexedDB
- ✅ 刷新页面后状态保持
- ✅ 递归隐藏所有子块和孙块

#### 技术实现
- 在 `Block` 类型添加 `collapsed: boolean` 字段
- 实现 `toggleBlockCollapse()` 函数
- 在 `buildFlatTree()` 中过滤被折叠的块
- 使用 Lucide React 图标（ChevronRight/ChevronDown）

### 🐛 修复的问题

#### Tab 缩进功能修复
- ✅ 修复 Dexie 查询语法错误（不能同时查询多个字段）
- ✅ 改用 `where({ pageId }).toArray()` 然后 `filter()` 过滤
- ✅ Tab 缩进现在可以正常工作

#### API Key 保存功能修复
- ✅ 移除 `require()` 动态导入（不兼容 ES Modules）
- ✅ 改用顶部 `import` 导入 `initializeOpenAI`
- ✅ API Key 现在可以正常保存和初始化

### 📝 文档更新
- ✅ 创建 `COLLAPSE_FEATURE.md` - 折叠功能详细文档
- ✅ 创建 `TROUBLESHOOTING.md` - 故障排查指南
- ✅ 更新 `README.md`
- ✅ 创建 `FINAL_SUMMARY.md` - 项目完成总结

---

## [v0.1.0] - 2025-10-13

### 🎉 MVP 初始版本

#### 核心功能
- ✅ 大纲编辑器（无限层级、Tab 缩进）
- ✅ 块级操作（UUID、父子关系、order 排序）
- ✅ AI 对话面板（右侧固定、流式输出）
- ✅ 一键插入 AI 回复到笔记
- ✅ 页面管理（创建、切换、搜索）
- ✅ 今日日记快捷入口
- ✅ IndexedDB 本地存储（Dexie.js）
- ✅ 实时数据同步

#### 技术栈
- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS
- IndexedDB (Dexie.js)
- OpenAI API (GPT-3.5-turbo)
- Lucide React 图标

#### 文档
- ✅ README.md
- ✅ QUICKSTART.md
- ✅ docs/ARCHITECTURE.md
- ✅ PROJECT_COMPLETED.md

---

## 后续计划

### v0.3.0（计划中）
- [ ] 双向链接 `[[页面名]]`
- [ ] 块引用 `((block-id))`
- [ ] 全文搜索（Cmd/Ctrl + K）
- [ ] 拖拽排序
- [ ] Markdown 渲染

### v0.4.0（计划中）
- [ ] 折叠功能键盘快捷键（Cmd/Ctrl + .）
- [ ] 全部折叠/展开按钮
- [ ] 显示折叠块的子块数量
- [ ] 导入/导出功能
- [ ] 主题切换

### v1.0.0（长期）
- [ ] Electron 桌面版
- [ ] 向量检索（RAG）
- [ ] 云同步（可选）
- [ ] 移动端适配

---

**维护者**: AI + Human  
**开始日期**: 2025-10-13  
**当前版本**: v0.2.0



