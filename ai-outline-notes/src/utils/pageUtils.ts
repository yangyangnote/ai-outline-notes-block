// 页面操作工具函数
import { db as realDb } from '../db/database';
import { getSyncEngine } from '../lib/syncEngine';
import { getVaultHandle } from '../lib/fileSystem';
import { deleteFile, getPageDirectory, generateFilename } from './fileOperations';
import type {
  Block,
  Page,
  PageVisit,
  ReferenceBreadcrumb,
  ReferenceEntry,
  ReferenceGroup,
} from '../types';

let dbInstance = realDb;

// 测试环境可以通过这些函数注入或还原数据库实例
export function __setPageUtilsDb(testDb: typeof realDb): void {
  dbInstance = testDb;
}

export function __resetPageUtilsDb(): void {
  dbInstance = realDb;
}

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
  const existingVisits = await dbInstance.pageVisits.where({ pageId }).toArray();

  if (existingVisits.length > 0) {
    existingVisits.sort((a, b) => b.visitedAt - a.visitedAt);
    const [latestVisit, ...olderVisits] = existingVisits;

    if (olderVisits.length > 0) {
      await dbInstance.pageVisits.bulkDelete(olderVisits.map(visit => visit.id));
    }

    await dbInstance.pageVisits.update(latestVisit.id, { visitedAt: now });
  } else {
    const visit: PageVisit = {
      id: crypto.randomUUID(),
      pageId,
      visitedAt: now,
    };

    await dbInstance.pageVisits.add(visit);
  }

  // 清理旧的访问记录（保留最近 100 条）
  const allVisits = await dbInstance.pageVisits.orderBy('visitedAt').reverse().toArray();
  if (allVisits.length > 100) {
    const visitsToDelete = allVisits.slice(100);
    await dbInstance.pageVisits.bulkDelete(visitsToDelete.map(v => v.id));
  }
}

// 获取最近访问的页面（去重）
export async function getRecentPages(limit: number = 10): Promise<Page[]> {
  // 获取所有访问记录，按时间倒序
  const visits = await dbInstance.pageVisits.orderBy('visitedAt').reverse().toArray();

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
    const page = await dbInstance.pages.get(visit.pageId);
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
  
  await dbInstance.pages.add(page);
  
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

  return await dbInstance.pages.where('title').equals(normalized).first();
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
      await dbInstance.pages.update(existing.id, { isReference: false, updatedAt: Date.now() });
      return await dbInstance.pages.get(existing.id) ?? existing;
    }
    return existing;
  }

  return await createPage(normalized, type, options);
}

// 更新页面标题
export async function updatePageTitle(id: string, title: string): Promise<void> {
  await dbInstance.pages.update(id, {
    title,
    updatedAt: Date.now(),
  });

  // 触发同步到文件系统
  await triggerPageSync(id);
}

// 删除页面（同时删除所有块和对应的文件）
export async function deletePage(id: string): Promise<void> {
  // 先获取页面信息（删除后就拿不到了）
  const page = await dbInstance.pages.get(id);

  // 删除数据库中的数据
  await dbInstance.blocks.where({ pageId: id }).delete();
  await dbInstance.pages.delete(id);

  // 删除聊天记录和访问历史
  await dbInstance.chatMessages.where({ pageId: id }).delete();
  await dbInstance.conversations.where({ pageId: id }).delete();
  await dbInstance.pageVisits.where({ pageId: id }).delete();

  // 尝试删除文件系统中的文件
  if (page) {
    try {
      const vaultHandle = await getVaultHandle();
      if (vaultHandle) {
        const dirName = getPageDirectory(page);
        const filename = generateFilename(page);

        // 获取对应的目录
        const dirHandle = await vaultHandle.getDirectoryHandle(dirName, { create: false });

        // 删除文件
        await deleteFile(dirHandle, filename);
        console.log(`✅ 已删除文件: ${dirName}/${filename}`);
      }
    } catch (error) {
      // 文件可能不存在或其他错误，仅记录警告
      console.warn('删除文件时出错（可能文件不存在）:', error);
    }
  }
}

// 获取所有页面
export async function getAllPages(): Promise<Page[]> {
  return await dbInstance.pages.orderBy('updatedAt').reverse().toArray();
}

// 搜索页面
export async function searchPages(query: string): Promise<Page[]> {
  const allPages = await dbInstance.pages.toArray();
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
  const existingDaily = await dbInstance.pages
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

const normalizeTitle = (title: string): string => title.trim().toLocaleLowerCase();

const titlesMatch = (a: string, b: string): boolean => normalizeTitle(a) === normalizeTitle(b);

const condenseContent = (content: string): string => {
  const condensed = content.replace(/\s+/g, ' ').trim();
  if (condensed.length <= 140) {
    return condensed;
  }
  return condensed.slice(0, 137) + '…';
};

const buildBreadcrumbs = (
  block: Block,
  blockMap: Map<string, Block>
): ReferenceBreadcrumb[] => {
  const breadcrumbs: ReferenceBreadcrumb[] = [];
  let current = block;

  while (current.parentId) {
    const parent = blockMap.get(current.parentId);
    if (!parent) {
      break;
    }

    breadcrumbs.push({
      blockId: parent.id,
      content: condenseContent(parent.content),
    });

    current = parent;
  }

  return breadcrumbs.reverse();
};

const createReferenceEntry = (
  block: Block,
  blockMap: Map<string, Block>,
  page: Page
): ReferenceEntry => ({
  blockId: block.id,
  blockContent: block.content,
  pageId: page.id,
  pageTitle: page.title,
  breadcrumbs: buildBreadcrumbs(block, blockMap),
  updatedAt: block.updatedAt,
});

export async function getLinkedReferences(
  pageId: string,
  pageTitle: string
): Promise<ReferenceGroup[]> {
  const normalized = pageTitle.trim();
  if (!normalized) {
    return [];
  }

  const [allBlocks, allPages] = await Promise.all([
    dbInstance.blocks.toArray(),
    dbInstance.pages.toArray(),
  ]);

  const blockMap = new Map(allBlocks.map(block => [block.id, block]));
  const pageMap = new Map(allPages.map(page => [page.id, page]));
  const groups = new Map<string, ReferenceGroup>();

  for (const block of allBlocks) {
    if (block.pageId === pageId) {
      continue;
    }

    const links = extractPageLinks(block.content)
      .map(link => link.trim())
      .filter(Boolean);

    if (!links.some(link => titlesMatch(link, normalized))) {
      continue;
    }

    const sourcePage = pageMap.get(block.pageId);
    if (!sourcePage) {
      continue;
    }

    const existingGroup = groups.get(block.pageId);
    if (existingGroup) {
      existingGroup.blocks.push(createReferenceEntry(block, blockMap, sourcePage));
      continue;
    }

    groups.set(block.pageId, {
      pageId: sourcePage.id,
      pageTitle: sourcePage.title,
      blocks: [createReferenceEntry(block, blockMap, sourcePage)],
    });
  }

  const orderedGroups = Array.from(groups.values());

  for (const group of orderedGroups) {
    group.blocks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  orderedGroups.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle, 'zh-CN'));

  return orderedGroups;
}

const WIKILINK_PATTERN = /\[\[[^\]]+\]\]/g;

export async function getUnlinkedReferences(
  pageId: string,
  pageTitle: string
): Promise<ReferenceGroup[]> {
  const normalized = pageTitle.trim();
  if (!normalized) {
    return [];
  }

  const loweredTitle = normalizeTitle(normalized);
  const [allBlocks, allPages] = await Promise.all([
    dbInstance.blocks.toArray(),
    dbInstance.pages.toArray(),
  ]);

  const blockMap = new Map(allBlocks.map(block => [block.id, block]));
  const pageMap = new Map(allPages.map(page => [page.id, page]));
  const groups = new Map<string, ReferenceGroup>();

  for (const block of allBlocks) {
    if (block.pageId === pageId) {
      continue;
    }

    const rawLinks = extractPageLinks(block.content)
      .map(link => link.trim())
      .filter(Boolean);

    if (rawLinks.some(link => titlesMatch(link, normalized))) {
      continue;
    }

    const contentWithoutLinks = block.content.replace(WIKILINK_PATTERN, ' ');
    const loweredContent = contentWithoutLinks.toLocaleLowerCase();

    if (!loweredContent.includes(loweredTitle)) {
      continue;
    }

    const sourcePage = pageMap.get(block.pageId);
    if (!sourcePage) {
      continue;
    }

    const existingGroup = groups.get(block.pageId);
    if (existingGroup) {
      existingGroup.blocks.push(createReferenceEntry(block, blockMap, sourcePage));
      continue;
    }

    groups.set(block.pageId, {
      pageId: sourcePage.id,
      pageTitle: sourcePage.title,
      blocks: [createReferenceEntry(block, blockMap, sourcePage)],
    });
  }

  const orderedGroups = Array.from(groups.values());

  for (const group of orderedGroups) {
    group.blocks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  orderedGroups.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle, 'zh-CN'));

  return orderedGroups;
}

// 获取反向链接（哪些块引用了当前页面）
export async function getBacklinks(pageTitle: string): Promise<Array<{
  blockId: string;
  blockContent: string;
  pageId: string;
  pageTitle: string;
}>> {
  const normalized = pageTitle.trim();
  if (!normalized) {
    return [];
  }

  const page = await dbInstance.pages.where('title').equals(normalized).first();
  if (!page) {
    return [];
  }

  const groups = await getLinkedReferences(page.id, page.title);
  const flattened: Array<{
    blockId: string;
    blockContent: string;
    pageId: string;
    pageTitle: string;
  }> = [];

  for (const group of groups) {
    for (const block of group.blocks) {
      flattened.push({
        blockId: block.blockId,
        blockContent: block.blockContent,
        pageId: group.pageId,
        pageTitle: group.pageTitle,
      });
    }
  }

  return flattened;
}

// 获取所有页面的反向链接数量
export async function getBacklinksCount(): Promise<Map<string, number>> {
  const [allBlocks, allPages] = await Promise.all([
    db.blocks.toArray(),
    db.pages.toArray(),
  ]);

  const pageMap = new Map(allPages.map(page => [page.id, page]));
  const backlinksCount = new Map<string, number>();

  // 初始化所有页面的计数为 0
  for (const page of allPages) {
    backlinksCount.set(page.id, 0);
  }

  // 遍历所有块，统计引用
  for (const block of allBlocks) {
    const links = extractPageLinks(block.content)
      .map(link => link.trim())
      .filter(Boolean);

    for (const linkTitle of links) {
      // 找到被引用的页面
      const targetPage = allPages.find(p => titlesMatch(p.title, linkTitle));
      if (targetPage) {
        const currentCount = backlinksCount.get(targetPage.id) || 0;
        backlinksCount.set(targetPage.id, currentCount + 1);
      }
    }
  }

  return backlinksCount;
}
