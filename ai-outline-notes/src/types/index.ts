// 核心数据类型定义

export interface Block {
  id: string;              // UUID
  content: string;         // Markdown 文本
  parentId: string | null; // 父块 ID（null = 顶层）
  pageId: string;          // 所属页面
  order: number;           // 同级排序
  collapsed: boolean;      // 是否折叠子块
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  title: string;
  type: 'note' | 'daily';  // 普通笔记 or 日记
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  pageId?: string;         // 关联的页面 ID
}

export interface AIConversation {
  id: string;
  messages: ChatMessage[];
  pageId: string;
  createdAt: number;
  updatedAt: number;
}

// UI 状态类型
export interface EditorState {
  currentPageId: string | null;
  selectedBlockId: string | null;
  isAIPanelOpen: boolean;
}

