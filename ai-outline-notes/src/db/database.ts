// IndexedDB 数据库配置（使用 Dexie）
import Dexie, { type EntityTable } from 'dexie';
import type { Block, Page, ChatMessage, AIConversation, PageVisit } from '../types';

class NotesDatabase extends Dexie {
  blocks!: EntityTable<Block, 'id'>;
  pages!: EntityTable<Page, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;
  conversations!: EntityTable<AIConversation, 'id'>;
  pageVisits!: EntityTable<PageVisit, 'id'>;

  constructor() {
    super('NotesDatabase');
    
    // 版本 1：初始版本
    this.version(1).stores({
      blocks: 'id, pageId, parentId, order, createdAt, updatedAt',
      pages: 'id, title, type, createdAt, updatedAt',
      chatMessages: 'id, pageId, createdAt',
      conversations: 'id, pageId, createdAt, updatedAt'
    });
    
    // 版本 2：添加 collapsed 字段
    this.version(2).stores({
      blocks: 'id, pageId, parentId, order, collapsed, createdAt, updatedAt',
      pages: 'id, title, type, createdAt, updatedAt',
      chatMessages: 'id, pageId, createdAt',
      conversations: 'id, pageId, createdAt, updatedAt'
    }).upgrade(async tx => {
      // 为所有旧块添加 collapsed 字段
      const blocks = await tx.table('blocks').toArray();
      for (const block of blocks) {
        if (block.collapsed === undefined) {
          await tx.table('blocks').update(block.id, { collapsed: false });
        }
      }
      console.log('数据库升级到版本 2：已为所有块添加 collapsed 字段');
    });

    // 版本 3：页面增加 isReference 标记
    this.version(3).stores({
      blocks: 'id, pageId, parentId, order, collapsed, createdAt, updatedAt',
      pages: 'id, title, type, isReference, createdAt, updatedAt',
      chatMessages: 'id, pageId, createdAt',
      conversations: 'id, pageId, createdAt, updatedAt'
    }).upgrade(async tx => {
      const pages = await tx.table('pages').toArray();
      for (const page of pages) {
        if (page.isReference === undefined) {
          await tx.table('pages').update(page.id, { isReference: false });
        }
      }
      console.log('数据库升级到版本 3：已为页面添加 isReference 标记');
    });

    // 版本 4：添加页面访问历史表
    this.version(4).stores({
      blocks: 'id, pageId, parentId, order, collapsed, createdAt, updatedAt',
      pages: 'id, title, type, isReference, createdAt, updatedAt',
      chatMessages: 'id, pageId, createdAt',
      conversations: 'id, pageId, createdAt, updatedAt',
      pageVisits: 'id, pageId, visitedAt, [pageId+visitedAt]'
    });

    // 版本 5：添加页面收藏功能
    this.version(5).stores({
      blocks: 'id, pageId, parentId, order, collapsed, createdAt, updatedAt',
      pages: 'id, title, type, isReference, isFavorite, createdAt, updatedAt',
      chatMessages: 'id, pageId, createdAt',
      conversations: 'id, pageId, createdAt, updatedAt',
      pageVisits: 'id, pageId, visitedAt, [pageId+visitedAt]'
    }).upgrade(async tx => {
      const pages = await tx.table('pages').toArray();
      for (const page of pages) {
        if (page.isFavorite === undefined) {
          await tx.table('pages').update(page.id, { isFavorite: false });
        }
      }
      console.log('数据库升级到版本 5：已为页面添加 isFavorite 标记');
    });
  }
}

// 创建数据库实例
export const db = new NotesDatabase();

// 初始化锁，防止并发初始化
let isInitializing = false;
let isInitialized = false;

// 初始化函数 - 创建默认页面
export async function initializeDatabase() {
  // 如果正在初始化或已初始化，直接返回
  if (isInitializing || isInitialized) {
    return;
  }
  
  isInitializing = true;
  
  const pageCount = await db.pages.count();
  
  if (pageCount === 0) {
    // 创建欢迎页面
    const welcomePageId = crypto.randomUUID();
    const now = Date.now();
    
    await db.pages.add({
      id: welcomePageId,
      title: '欢迎使用 AI 大纲笔记',
      type: 'note',
      isReference: false,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });
    
    // 添加一些初始块
    const welcomeBlocks: Block[] = [
      {
        id: crypto.randomUUID(),
        content: '# 欢迎使用 AI 大纲笔记 👋',
        parentId: null,
        pageId: welcomePageId,
        order: 0,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '这是一个结合了大纲笔记和 AI 助手的应用',
        parentId: null,
        pageId: welcomePageId,
        order: 1,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '## 快速开始',
        parentId: null,
        pageId: welcomePageId,
        order: 2,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '- 使用 **Tab** 缩进，**Shift+Tab** 反缩进',
        parentId: null,
        pageId: welcomePageId,
        order: 3,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '- 选中文本后，点击右侧 AI 助手提问',
        parentId: null,
        pageId: welcomePageId,
        order: 4,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '- 使用 [[页面名]] 创建双向链接',
        parentId: null,
        pageId: welcomePageId,
        order: 5,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        content: '- 点击左侧箭头可以折叠/展开子块 ▶️',
        parentId: null,
        pageId: welcomePageId,
        order: 6,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
    
    await db.blocks.bulkAdd(welcomeBlocks);
    
    console.log('数据库初始化完成');
  }
  
  isInitializing = false;
  isInitialized = true;
}
