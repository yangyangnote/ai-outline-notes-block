// 页面操作工具函数
import { db } from '../db/database';
import type { Page } from '../types';

// 创建新页面
export async function createPage(
  title: string,
  type: 'note' | 'daily' = 'note'
): Promise<Page> {
  const now = Date.now();
  const page: Page = {
    id: crypto.randomUUID(),
    title,
    type,
    createdAt: now,
    updatedAt: now,
  };
  
  await db.pages.add(page);
  return page;
}

// 更新页面标题
export async function updatePageTitle(id: string, title: string): Promise<void> {
  await db.pages.update(id, {
    title,
    updatedAt: Date.now(),
  });
}

// 删除页面（同时删除所有块）
export async function deletePage(id: string): Promise<void> {
  // 删除页面的所有块
  await db.blocks.where({ pageId: id }).delete();
  
  // 删除页面
  await db.pages.delete(id);
}

// 获取所有页面
export async function getAllPages(): Promise<Page[]> {
  return await db.pages.orderBy('updatedAt').reverse().toArray();
}

// 搜索页面
export async function searchPages(query: string): Promise<Page[]> {
  const allPages = await db.pages.toArray();
  const lowerQuery = query.toLowerCase();
  
  return allPages.filter(page => 
    page.title.toLowerCase().includes(lowerQuery)
  );
}

// 创建或获取今日日记
export async function getTodayDaily(): Promise<Page> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const title = formatDateTitle(today);
  
  // 查找是否已存在今日日记
  const existingDaily = await db.pages
    .where('title')
    .equals(title)
    .first();
  
  if (existingDaily) {
    return existingDaily;
  }
  
  // 创建新的日记页面
  return await createPage(title, 'daily');
}

// 格式化日期标题
function formatDateTitle(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 解析页面中的双向链接
export function extractPageLinks(content: string): string[] {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }
  
  return links;
}

// 获取反向链接（哪些块引用了当前页面）
export async function getBacklinks(pageTitle: string): Promise<Array<{
  blockId: string;
  blockContent: string;
  pageId: string;
  pageTitle: string;
}>> {
  const allBlocks = await db.blocks.toArray();
  const backlinks = [];
  
  for (const block of allBlocks) {
    const links = extractPageLinks(block.content);
    if (links.includes(pageTitle)) {
      const page = await db.pages.get(block.pageId);
      if (page) {
        backlinks.push({
          blockId: block.id,
          blockContent: block.content,
          pageId: block.pageId,
          pageTitle: page.title,
        });
      }
    }
  }
  
  return backlinks;
}

