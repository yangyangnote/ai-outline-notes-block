// 开发工具 - 在浏览器控制台中使用
import { db } from '../db/database';
import { cleanupDuplicatePages, clearAllData, exportAllData, getDatabaseStats } from './dbMaintenance';
import { getVaultHandle } from '../lib/fileSystem';
import { migrateToFileSystem, importFromFileSystem } from './migration';

// 将工具函数挂载到 window 对象，方便在控制台调用
declare global {
  interface Window {
    devTools: {
      stats: () => Promise<void>;
      cleanup: () => Promise<void>;
      reset: () => Promise<void>;
      export: () => Promise<void>;
      deleteEmptyBlocks: () => Promise<void>;
      migrateToFiles: () => Promise<void>;
      importFromFiles: () => Promise<void>;
      keepOnlyPage: (pageTitle: string) => Promise<void>;
    };
  }
}

// 删除所有空块
async function deleteEmptyBlocks() {
  const allBlocks = await db.blocks.toArray();
  const emptyBlocks = allBlocks.filter(b => !b.content.trim());
  
  if (emptyBlocks.length === 0) {
    console.log('没有发现空块');
    return;
  }
  
  console.log(`发现 ${emptyBlocks.length} 个空块，正在删除...`);
  
  for (const block of emptyBlocks) {
    await db.blocks.delete(block.id);
  }
  
  console.log('✅ 所有空块已删除');
  window.location.reload();
}

// 显示数据库统计
async function showStats() {
  const stats = await getDatabaseStats();
  console.log('📊 数据库统计信息：');
  console.log(`  - 页面数量: ${stats.pagesCount}`);
  console.log(`  - 块数量: ${stats.blocksCount}`);
  console.log(`  - 对话数量: ${stats.conversationsCount}`);
  console.log(`  - 总大小: ${stats.totalSize}`);
}

// 清理重复页面
async function cleanup() {
  console.log('🧹 开始清理重复页面...');
  await cleanupDuplicatePages();
  await deleteEmptyBlocks();
  console.log('✅ 清理完成');
}

// 重置所有数据
async function reset() {
  console.log('⚠️  即将清除所有数据...');
  await clearAllData();
}

// 导出数据
async function exportData() {
  const jsonData = await exportAllData();
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('✅ 数据已导出');
}

// 迁移数据到文件系统
async function migrateToFiles() {
  const vaultHandle = await getVaultHandle();
  if (!vaultHandle) {
    console.error('❌ 未选择 vault，请先选择笔记文件夹');
    return;
  }

  console.log('🔄 开始迁移数据到文件系统...');
  
  await migrateToFileSystem(vaultHandle, {
    onProgress: (current, total) => {
      console.log(`📝 进度: ${current}/${total}`);
    },
  });
  
  console.log('✅ 迁移完成！');
}

// 从文件系统导入数据
async function importFromFiles() {
  const vaultHandle = await getVaultHandle();
  if (!vaultHandle) {
    console.error('❌ 未选择 vault，请先选择笔记文件夹');
    return;
  }

  if (!confirm('从文件系统导入会覆盖现有数据，确定继续吗？')) {
    return;
  }

  console.log('🔄 开始从文件系统导入数据...');

  await importFromFileSystem(vaultHandle, {
    clearExisting: true,
    onProgress: (current, total) => {
      console.log(`📝 进度: ${current}/${total}`);
    },
  });

  console.log('✅ 导入完成！');
  window.location.reload();
}

// 只保留指定页面，删除其他所有数据
async function keepOnlyPage(pageTitle: string) {
  console.log(`🔍 查找页面: "${pageTitle}"...`);

  // 查找目标页面
  const targetPage = await db.pages
    .filter(p => p.title === pageTitle)
    .first();

  if (!targetPage) {
    console.error(`❌ 找不到页面 "${pageTitle}"`);
    const allPages = await db.pages.toArray();
    console.log('📄 当前所有页面：');
    allPages.forEach(p => console.log(`  - ${p.title}`));
    return;
  }

  console.log(`✅ 找到页面: ${targetPage.title} (ID: ${targetPage.id})`);

  // 获取要删除的其他页面
  const pagesToDelete = await db.pages
    .filter(p => p.id !== targetPage.id)
    .toArray();

  console.log(`🗑️  将删除 ${pagesToDelete.length} 个页面...`);

  // 删除不属于目标页面的所有块
  const blocksToDelete = await db.blocks
    .filter(b => b.pageId !== targetPage.id)
    .toArray();

  console.log(`🗑️  将删除 ${blocksToDelete.length} 个块...`);

  // 开始删除
  await db.transaction('rw', db.pages, db.blocks, db.chatMessages, db.conversations, db.pageVisits, async () => {
    // 删除其他页面的块
    for (const block of blocksToDelete) {
      await db.blocks.delete(block.id);
    }

    // 删除其他页面
    for (const page of pagesToDelete) {
      await db.pages.delete(page.id);
    }

    // 删除不属于目标页面的聊天记录
    await db.chatMessages
      .filter(m => m.pageId !== targetPage.id)
      .delete();

    // 删除不属于目标页面的对话
    await db.conversations
      .filter(c => c.pageId !== targetPage.id)
      .delete();

    // 删除不属于目标页面的访问历史
    await db.pageVisits
      .filter(v => v.pageId !== targetPage.id)
      .delete();
  });

  console.log('✅ 清理完成！');
  console.log(`📄 保留的页面: ${targetPage.title}`);

  // 刷新页面
  window.location.reload();
}

// 初始化开发工具
export function initDevTools() {
  window.devTools = {
    stats: showStats,
    cleanup: cleanup,
    reset: reset,
    export: exportData,
    deleteEmptyBlocks: deleteEmptyBlocks,
    migrateToFiles: migrateToFiles,
    importFromFiles: importFromFiles,
    keepOnlyPage: keepOnlyPage,
  };

  console.log('🛠️ 开发工具已加载！使用以下命令：');
  console.log('  - devTools.stats()          查看数据库统计');
  console.log('  - devTools.cleanup()        清理重复页面和空块');
  console.log('  - devTools.deleteEmptyBlocks()  删除所有空块');
  console.log('  - devTools.export()         导出 JSON 备份');
  console.log('  - devTools.migrateToFiles() 迁移数据到文件系统');
  console.log('  - devTools.importFromFiles() 从文件系统导入数据');
  console.log('  - devTools.keepOnlyPage("页面名")  只保留指定页面，删除其他数据');
  console.log('  - devTools.reset()          清除所有数据（慎用！）');
}



