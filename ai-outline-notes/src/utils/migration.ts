// 数据迁移工具
// 用于在 IndexedDB 和文件系统之间迁移数据

import { db } from '../db/database';
import type { Page } from '../types';
import { writePageFile, readAllPagesFromDirectory } from './fileOperations';
import { initializeVaultStructure } from './fileOperations';

// ==================== IndexedDB → 文件系统 ====================

export async function migrateToFileSystem(
  vaultHandle: FileSystemDirectoryHandle,
  options: {
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<void> {
  const { onProgress } = options;

  try {
    console.log('🔄 开始迁移数据到文件系统...');

    // 1. 初始化 vault 结构
    await initializeVaultStructure(vaultHandle);

    // 2. 获取所有页面
    const pages = await db.pages.toArray();
    const total = pages.length;

    console.log(`📝 找到 ${total} 个页面需要迁移`);

    // 3. 迁移每个页面
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      
      try {
        // 获取页面的所有块
        const blocks = await db.blocks.where({ pageId: page.id }).sortBy('order');

        // 确定目标目录
        const dirName = page.type === 'daily' ? 'journals' : 'pages';
        const dirHandle = await vaultHandle.getDirectoryHandle(dirName, { create: true });

        // 写入文件
        await writePageFile(dirHandle, page, blocks);

        if (onProgress) {
          onProgress(i + 1, total);
        }

        console.log(`✓ 迁移: ${page.title}`);
      } catch (error) {
        console.error(`✗ 迁移失败: ${page.title}`, error);
      }
    }

    console.log('✅ 数据迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    throw new Error('数据迁移失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// ==================== 文件系统 → IndexedDB ====================

export async function importFromFileSystem(
  vaultHandle: FileSystemDirectoryHandle,
  options: {
    clearExisting?: boolean;  // 是否清除现有数据
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<void> {
  const { clearExisting = false, onProgress } = options;

  try {
    console.log('🔄 开始从文件系统导入数据...');

    // 1. 清除现有数据（如果需要）
    if (clearExisting) {
      await db.blocks.clear();
      await db.pages.clear();
      console.log('🗑️ 已清除现有数据');
    }

    // 2. 读取 pages 目录
    const pagesDir = await vaultHandle.getDirectoryHandle('pages', { create: true });
    const pagesData = await readAllPagesFromDirectory(pagesDir);

    // 3. 读取 journals 目录
    const journalsDir = await vaultHandle.getDirectoryHandle('journals', { create: true });
    const journalsData = await readAllPagesFromDirectory(journalsDir);

    const allData = [...pagesData, ...journalsData];
    const total = allData.length;

    console.log(`📝 找到 ${total} 个文件需要导入`);

    // 4. 导入每个页面
    for (let i = 0; i < allData.length; i++) {
      const { page: pageData, blocks } = allData[i];

      try {
        // 确保页面有完整的数据
        const page: Page = {
          id: pageData.id || crypto.randomUUID(),
          title: pageData.title || '未命名',
          type: pageData.type || 'note',
          isReference: pageData.isReference || false,
          createdAt: pageData.createdAt || Date.now(),
          updatedAt: pageData.updatedAt || Date.now(),
        };

        // 检查页面是否已存在
        const existing = await db.pages.get(page.id);
        
        if (existing) {
          // 更新现有页面
          await db.pages.update(page.id, {
            title: page.title,
            type: page.type,
            updatedAt: page.updatedAt,
          });
        } else {
          // 添加新页面
          await db.pages.add(page);
        }

        // 删除旧块，添加新块
        await db.blocks.where({ pageId: page.id }).delete();
        if (blocks.length > 0) {
          await db.blocks.bulkAdd(blocks);
        }

        if (onProgress) {
          onProgress(i + 1, total);
        }

        console.log(`✓ 导入: ${page.title}`);
      } catch (error) {
        console.error(`✗ 导入失败: ${pageData.title}`, error);
      }
    }

    console.log('✅ 数据导入完成！');
  } catch (error) {
    console.error('导入失败:', error);
    throw new Error('数据导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

// ==================== 数据验证 ====================

export async function validateVaultStructure(
  vaultHandle: FileSystemDirectoryHandle
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 检查必要的目录
    try {
      await vaultHandle.getDirectoryHandle('pages');
    } catch {
      warnings.push('缺少 pages 目录');
    }

    try {
      await vaultHandle.getDirectoryHandle('journals');
    } catch {
      warnings.push('缺少 journals 目录');
    }

    try {
      const metaDir = await vaultHandle.getDirectoryHandle('.notesdb');
      try {
        await metaDir.getFileHandle('config.json');
      } catch {
        warnings.push('缺少配置文件 .notesdb/config.json');
      }
    } catch {
      warnings.push('缺少元数据目录 .notesdb');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push('无法访问文件夹: ' + (error instanceof Error ? error.message : '未知错误'));
    return { valid: false, errors, warnings };
  }
}

// ==================== 备份和恢复 ====================

export async function createBackup(
  vaultHandle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDirName = `.backup-${timestamp}`;
    
    const backupDir = await vaultHandle.getDirectoryHandle(backupDirName, { create: true });
    
    // 导出所有数据到备份目录
    await migrateToFileSystem(backupDir);
    
    console.log(`✅ 备份已创建: ${backupDirName}`);
  } catch (error) {
    console.error('创建备份失败:', error);
    throw new Error('无法创建备份');
  }
}
