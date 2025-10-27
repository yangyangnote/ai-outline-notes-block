// 页面操作工具函数
import { db } from '../db/database';
import { getSyncEngine } from '../lib/syncEngine';
import type { Page, PageVisit } from '../types';

// 触发页面同步到文件系统
async function triggerPageSync(pageId: string): Promise<void> {
  try {
    const syncEngine = getSyncEngine();
    setTimeout(() => {
      syncEngine.syncToFileSystem(pageId).catch(err => {
        console.error('后台同步失败:', err);
      });
    }, 100);
  } catch (error) {
    console.warn('同步触发失败:', error);
  }
}

// 记录页面访问历史
export async function recordPageVisit(pageId: string): Promise<void> {
  const now = Date.now();
  const visit: PageVisit = {
    id: crypto.randomUUID(),
    pageId,
    visitedAt: now,
  };

  await db.pageVisits.add(visit);

  // 清理旧的访问记录（保留最近 100 条）
  const allVisits = await db.pageVisits.orderBy('visitedAt').reverse().toArray();
  if (allVisits.length > 100) {
    const visitsToDelete = allVisits.slice(100);
    await db.pageVisits.bulkDelete(visitsToDelete.map(v => v.id));
  }
}

// 获取最近访问的页面（去重）
export async function getRecentPages(limit: number = 10): Promise<Page[]> {
  // 获取所有访问记录，按时间倒序
  const visits = await db.pageVisits.orderBy('visitedAt').reverse().toArray();

  // 去重，保留每个页面最近的一次访问
  const seenPageIds = new Set<string>();
  const uniqueVisits: PageVisit[] = [];

  for (const visit of visits) {
    if (!seenPageIds.has(visit.pageId)) {
      seenPageIds.add(visit.pageId);
      uniqueVisits.push(visit);

      if (uniqueVisits.length >= limit) {
        break;
      }
    }
  }

  // 根据访问记录获取页面信息
  const pages: Page[] = [];
  for (const visit of uniqueVisits) {
    const page = await db.pages.get(visit.pageId);
    if (page) {
      pages.push(page);
    }
  }

  return pages;
}

// 创建新页面
export async function createPage(
  title: string,
  type: 'note' | 'daily' = 'note',
  options?: {
    isReference?: boolean;
  }
): Promise<Page> {
  const now = Date.now();
  const page: Page = {
    id: crypto.randomUUID(),
    title,
    type,
    isReference: options?.isReference ?? false,
    createdAt: now,
    updatedAt: now,
  };
  
  await db.pages.add(page);
  
  // 触发同步到文件系统
  await triggerPageSync(page.id);
  
  return page;
}

// 根据标题获取页面
export async function getPageByTitle(title: string): Promise<Page | undefined> {
  const normalized = title.trim();
  if (!normalized) {
    return undefined;
  }

  return await db.pages.where('title').equals(normalized).first();
}

// 确保页面存在（若不存在则创建）
export async function ensurePageByTitle(
  title: string,
  type: 'note' | 'daily' = 'note',
  options?: {
    isReference?: boolean;
  }
): Promise<Page | undefined> {
  const normalized = title.trim();
  if (!normalized) {
    return undefined;
  }

  const existing = await getPageByTitle(normalized);
  if (existing) {
    if (options?.isReference === false && existing.isReference) {
      await db.pages.update(existing.id, { isReference: false, updatedAt: Date.now() });
      return await db.pages.get(existing.id) ?? existing;
    }
    return existing;
  }

  return await createPage(normalized, type, options);
}

// 更新页面标题
export async function updatePageTitle(id: string, title: string): Promise<void> {
  await db.pages.update(id, {
    title,
    updatedAt: Date.now(),
  });

  // 触发同步到文件系统
  await triggerPageSync(id);
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
