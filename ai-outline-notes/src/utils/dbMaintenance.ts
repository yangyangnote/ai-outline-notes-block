// 数据库维护工具
import { db } from '../db/database';

// 清理重复的欢迎页面
export async function cleanupDuplicatePages(): Promise<void> {
  const pages = await db.pages.toArray();
  
  // 查找所有标题为"欢迎使用 AI 大纲笔记"的页面
  const welcomePages = pages.filter(p => p.title === '欢迎使用 AI 大纲笔记');
  
  if (welcomePages.length > 1) {
    console.log(`发现 ${welcomePages.length} 个重复的欢迎页面，正在清理...`);
    
    // 保留最新的一个，删除其他的
    const sortedPages = welcomePages.sort((a, b) => b.createdAt - a.createdAt);
    const keepPage = sortedPages[0];
    const deletePages = sortedPages.slice(1);
    
    for (const page of deletePages) {
      // 删除页面的所有块
      await db.blocks.where({ pageId: page.id }).delete();
      // 删除页面
      await db.pages.delete(page.id);
    }
    
    console.log(`已清理 ${deletePages.length} 个重复页面`);
  }
}

// 清除所有数据（慎用！）
export async function clearAllData(): Promise<void> {
  if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
    await db.blocks.clear();
    await db.pages.clear();
    await db.chatMessages.clear();
    await db.conversations.clear();
    console.log('所有数据已清除');
    window.location.reload();
  }
}

// 导出所有数据（备份）
export async function exportAllData(): Promise<string> {
  const blocks = await db.blocks.toArray();
  const pages = await db.pages.toArray();
  const conversations = await db.conversations.toArray();
  
  const data = {
    version: 2,
    exportDate: new Date().toISOString(),
    blocks,
    pages,
    conversations,
  };
  
  return JSON.stringify(data, null, 2);
}

// 导入数据
export async function importData(jsonData: string): Promise<void> {
  try {
    const data = JSON.parse(jsonData);
    
    if (confirm('导入数据会覆盖现有数据，确定继续吗？')) {
      await clearAllData();
      
      if (data.blocks) await db.blocks.bulkAdd(data.blocks);
      if (data.pages) await db.pages.bulkAdd(data.pages);
      if (data.conversations) await db.conversations.bulkAdd(data.conversations);
      
      console.log('数据导入成功');
      window.location.reload();
    }
  } catch (error) {
    console.error('导入失败:', error);
    alert('导入失败，请检查数据格式');
  }
}

// 数据库统计信息
export async function getDatabaseStats(): Promise<{
  blocksCount: number;
  pagesCount: number;
  conversationsCount: number;
  totalSize: string;
}> {
  const blocksCount = await db.blocks.count();
  const pagesCount = await db.pages.count();
  const conversationsCount = await db.conversations.count();
  
  // 估算大小（粗略）
  const blocks = await db.blocks.toArray();
  const totalChars = blocks.reduce((sum, b) => sum + b.content.length, 0);
  const totalSize = `约 ${Math.ceil(totalChars / 1024)} KB`;
  
  return {
    blocksCount,
    pagesCount,
    conversationsCount,
    totalSize,
  };
}



