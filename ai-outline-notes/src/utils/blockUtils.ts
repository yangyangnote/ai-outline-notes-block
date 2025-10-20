// 块操作工具函数
import { db } from '../db/database';
import { extractPageLinks, ensurePageByTitle } from './pageUtils';
import { getSyncEngine } from '../lib/syncEngine';
import type { Block } from '../types';

const getUniqueLinkTitles = (content: string): string[] => {
  return Array.from(
    new Set(
      extractPageLinks(content)
        .map(title => title.trim())
        .filter(title => title.length > 0)
    )
  );
};

export const ensureLinksForContent = async (content: string): Promise<void> => {
  const linkTitles = getUniqueLinkTitles(content);
  for (const title of linkTitles) {
    await ensurePageByTitle(title, 'note', { isReference: true });
  }
};

// 触发页面同步到文件系统
async function triggerPageSync(pageId: string): Promise<void> {
  try {
    const syncEngine = getSyncEngine();
    // 异步同步，不阻塞 UI
    setTimeout(() => {
      syncEngine.syncToFileSystem(pageId).catch(err => {
        console.error('后台同步失败:', err);
      });
    }, 100);
  } catch (error) {
    // 静默失败，不影响编辑体验
    console.warn('同步触发失败:', error);
  }
}

// 创建新块
export async function createBlock(
  pageId: string,
  content: string = '',
  parentId: string | null = null,
  order?: number
): Promise<Block> {
  const now = Date.now();
  
  // 如果没有指定 order，获取同级最大 order + 1
  if (order === undefined) {
    const siblings = await db.blocks
      .where('pageId')
      .equals(pageId)
      .filter(block => block.parentId === parentId)
      .toArray();
    order = siblings.length > 0 ? Math.max(...siblings.map(b => b.order)) + 1 : 0;
  }
  
  const block: Block = {
    id: crypto.randomUUID(),
    content,
    parentId,
    pageId,
    order,
    collapsed: false, // 默认不折叠
    createdAt: now,
    updatedAt: now,
  };
  
  await db.blocks.add(block);
  await ensureLinksForContent(content);
  
  // 触发同步到文件系统
  await triggerPageSync(pageId);
  
  return block;
}

// 更新块内容
export async function updateBlock(id: string, content: string): Promise<void> {
  const block = await db.blocks.get(id);
  if (!block) return;

  await db.blocks.update(id, {
    content,
    updatedAt: Date.now(),
  });

  // 触发同步到文件系统
  await triggerPageSync(block.pageId);
}

// 删除块（递归删除子块）
export async function deleteBlock(id: string): Promise<void> {
  const block = await db.blocks.get(id);
  if (!block) return;

  // 查找所有子块
  const children = await db.blocks.where({ parentId: id }).toArray();
  
  // 递归删除子块
  for (const child of children) {
    await deleteBlock(child.id);
  }
  
  // 删除当前块
  await db.blocks.delete(id);

  // 触发同步到文件系统
  await triggerPageSync(block.pageId);
}

// 移动块（改变父块或顺序）
export async function moveBlock(
  blockId: string,
  newParentId: string | null,
  newOrder: number
): Promise<void> {
  await db.blocks.update(blockId, {
    parentId: newParentId,
    order: newOrder,
    updatedAt: Date.now(),
  });
}

// 获取页面的所有块（树形结构）
export async function getPageBlocks(pageId: string): Promise<Block[]> {
  return await db.blocks
    .where({ pageId })
    .sortBy('order');
}

// 获取块的所有子块
export async function getChildBlocks(parentId: string): Promise<Block[]> {
  return await db.blocks
    .where({ parentId })
    .sortBy('order');
}

// 缩进块（成为上一个兄弟块的子块）
export async function indentBlock(blockId: string): Promise<boolean> {
  const block = await db.blocks.get(blockId);
  if (!block) return false;
  
  // 找到所有同级兄弟块
  const allBlocks = await db.blocks.where({ pageId: block.pageId }).toArray();
  const siblings = allBlocks
    .filter(b => b.parentId === block.parentId)
    .sort((a, b) => a.order - b.order);
  
  const currentIndex = siblings.findIndex(b => b.id === blockId);
  if (currentIndex <= 0) return false; // 已经是第一个，无法缩进
  
  const previousSibling = siblings[currentIndex - 1];
  
  // 获取新父块的子块数量，确定新 order
  const newSiblings = await getChildBlocks(previousSibling.id);
  const newOrder = newSiblings.length;
  
  await moveBlock(blockId, previousSibling.id, newOrder);
  return true;
}

// 反缩进块（成为父块的兄弟块）
export async function outdentBlock(blockId: string): Promise<boolean> {
  const block = await db.blocks.get(blockId);
  if (!block || !block.parentId) return false; // 已经是顶层
  
  const parent = await db.blocks.get(block.parentId);
  if (!parent) return false;
  
  // 获取父块的所有兄弟块
  const allBlocks = await db.blocks.where({ pageId: block.pageId }).toArray();
  const parentSiblings = allBlocks
    .filter(b => b.parentId === parent.parentId)
    .sort((a, b) => a.order - b.order);
  
  const parentIndex = parentSiblings.findIndex(b => b.id === parent.id);
  const newOrder = parent.order + 1;
  
  // 更新后面兄弟块的 order
  for (let i = parentIndex + 1; i < parentSiblings.length; i++) {
    await db.blocks.update(parentSiblings[i].id, {
      order: parentSiblings[i].order + 1
    });
  }
  
  await moveBlock(blockId, parent.parentId, newOrder);
  return true;
}

// 切换块的折叠状态
export async function toggleBlockCollapse(blockId: string): Promise<void> {
  const block = await db.blocks.get(blockId);
  if (!block) return;
  
  await db.blocks.update(blockId, {
    collapsed: !block.collapsed,
    updatedAt: Date.now(),
  });
}

// 检查块是否有子块
export async function hasChildren(blockId: string): Promise<boolean> {
  const children = await db.blocks.where({ parentId: blockId }).count();
  return children > 0;
}
