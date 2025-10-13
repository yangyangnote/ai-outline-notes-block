# 架构设计文档

## 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     React Application                    │
├─────────────┬───────────────────┬──────────────────────┤
│  Sidebar    │  OutlineEditor    │     AIPanel          │
│  (页面管理)  │   (大纲编辑)      │    (AI 对话)         │
└─────────────┴───────────────────┴──────────────────────┘
       ↓              ↓                      ↓
┌─────────────────────────────────────────────────────────┐
│                  State Management                        │
│  currentPageId, selectedBlockId, messages, etc.         │
└─────────────────────────────────────────────────────────┘
       ↓              ↓                      ↓
┌─────────────────────────────────────────────────────────┐
│              Data Layer (utils + db)                    │
│  pageUtils.ts  │  blockUtils.ts  │  openai.ts          │
└─────────────────────────────────────────────────────────┘
       ↓              ↓                      ↓
┌─────────────────────────────────────────────────────────┐
│         Storage Layer (IndexedDB + OpenAI API)          │
│  Dexie.js      │   Blocks/Pages   │   GPT-3.5          │
└─────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 数据模型 (`src/types/index.ts`)

```typescript
Block {
  id: UUID
  content: string
  parentId: UUID | null  // 父块 ID，形成树形结构
  pageId: UUID
  order: number          // 同级排序
  timestamps
}

Page {
  id: UUID
  title: string
  type: 'note' | 'daily'
  timestamps
}
```

### 2. 数据库层 (`src/db/database.ts`)

- 使用 Dexie.js 封装 IndexedDB
- 自动索引：pageId, parentId, order
- 实时查询：useLiveQuery hook
- 初始化时创建欢迎页面

### 3. 工具函数

#### Block Utils (`src/utils/blockUtils.ts`)
- `createBlock`: 创建新块
- `updateBlock`: 更新内容
- `deleteBlock`: 递归删除
- `indentBlock`: 缩进（改变父子关系）
- `outdentBlock`: 反缩进
- `getPageBlocks`: 查询页面所有块

#### Page Utils (`src/utils/pageUtils.ts`)
- `createPage`: 创建页面
- `getTodayDaily`: 获取/创建今日日记
- `searchPages`: 搜索页面
- `extractPageLinks`: 解析双向链接（为后续功能准备）
- `getBacklinks`: 反向链接（为后续功能准备）

### 4. UI 组件

#### BlockEditor (`src/components/Editor/BlockEditor.tsx`)
单个块的编辑器：
- 自适应高度 textarea
- 键盘导航（Tab, Enter, Arrow keys）
- 拖拽手柄（UI 已有，逻辑待实现）

#### OutlineEditor (`src/components/Editor/OutlineEditor.tsx`)
大纲编辑器主控制器：
- 实时查询块数据
- 计算块层级
- 构建展平树结构
- 处理所有块操作事件

#### AIPanel (`src/components/AIPanel/AIPanel.tsx`)
AI 对话面板：
- 流式输出（打字机效果）
- 上下文感知（当前页面 + 选中内容）
- 消息历史
- API Key 管理

## 数据流

### 1. 块编辑流程

```
用户输入
  ↓
BlockEditor.onChange
  ↓
OutlineEditor.handleUpdate
  ↓
updateBlock(id, content) → IndexedDB
  ↓
Dexie triggers update
  ↓
useLiveQuery 自动重新查询
  ↓
UI 自动更新
```

### 2. 缩进/反缩进流程

```
用户按 Tab
  ↓
BlockEditor.handleKeyDown
  ↓
OutlineEditor.handleIndent
  ↓
indentBlock(id)
  ↓
查找上一个兄弟块
  ↓
更新 parentId 和 order
  ↓
IndexedDB 更新
  ↓
UI 自动刷新（层级改变）
```

### 3. AI 对话流程

```
用户输入问题
  ↓
AIPanel.handleSend
  ↓
构建 messages 数组
  ├─ system prompt (当前页面上下文)
  ├─ 历史消息
  └─ 用户问题 + 选中内容
  ↓
streamChatCompletion(messages)
  ↓
OpenAI API (流式响应)
  ↓
逐字更新 UI
  ↓
用户点击 "插入到笔记"
  ↓
createBlock(pageId, content)
  ↓
新块出现在笔记中
```

## 性能优化

### 已实现
1. **实时查询**：Dexie useLiveQuery 只更新变化的数据
2. **自适应高度**：textarea 根据内容自动调整
3. **流式输出**：AI 响应逐字显示，降低等待感

### 待优化
1. **虚拟滚动**：当块数量 > 1000 时启用
2. **防抖输入**：减少 updateBlock 调用频率
3. **Web Worker**：向量嵌入在后台线程运行
4. **索引优化**：为常用查询添加复合索引

## 扩展性设计

### 1. 插件系统（预留）
```typescript
interface Plugin {
  name: string;
  onBlockCreate?: (block: Block) => void;
  onBlockUpdate?: (block: Block) => void;
  renderBlockExtra?: (block: Block) => ReactNode;
}
```

### 2. 自定义块类型（预留）
```typescript
interface Block {
  type: 'text' | 'code' | 'image' | 'embed';
  data: Record<string, any>;
}
```

### 3. 协同编辑（预留）
- CRDT 数据结构
- WebSocket 实时同步
- 冲突解决策略

## 安全性

### 当前实现
- API Key 存储在 localStorage（仅开发用）
- 所有数据本地存储，不上传服务器

### 生产环境建议
1. **后端代理 API**：前端不直接调用 OpenAI
2. **用户认证**：JWT + 会话管理
3. **端到端加密**：云同步时加密数据
4. **CORS 策略**：限制 API 访问源

## 测试策略

### 待实现
1. **单元测试**：utils 函数（Jest）
2. **组件测试**：React Testing Library
3. **E2E 测试**：Playwright
4. **性能测试**：大量块时的响应时间

## 部署方案

### 开发环境
```bash
npm run dev  # Vite 开发服务器
```

### 生产构建
```bash
npm run build  # 输出到 dist/
```

### 部署选项
1. **Vercel**：零配置部署
2. **Netlify**：自动 CI/CD
3. **GitHub Pages**：静态托管
4. **Electron**：打包为桌面应用

## 依赖管理

### 核心依赖
- `react` / `react-dom`: UI 框架
- `dexie` / `dexie-react-hooks`: IndexedDB
- `openai`: AI 集成
- `lucide-react`: 图标库
- `tailwindcss`: CSS 框架

### 开发依赖
- `vite`: 构建工具
- `typescript`: 类型检查
- `eslint`: 代码检查

### 升级策略
- 每月检查安全更新
- 重要功能更新前测试兼容性
- 使用 `npm audit` 检查漏洞

---

**最后更新**: 2025-10-13

