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
  type: 'note' | 'daily';
  isReference?: boolean;
  isFavorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReferenceBreadcrumb {
  blockId: string;
  content: string;
}

export interface ReferenceEntry {
  blockId: string;
  blockContent: string;
  pageId: string;
  pageTitle: string;
  breadcrumbs: ReferenceBreadcrumb[];
  updatedAt: number;
}

export interface ReferenceGroup {
  pageId: string;
  pageTitle: string;
  blocks: ReferenceEntry[];
}

export interface PageVisit {
  id: string;              // UUID
  pageId: string;          // 访问的页面 ID
  visitedAt: number;       // 访问时间戳
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
