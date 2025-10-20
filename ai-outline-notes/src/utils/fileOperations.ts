// 文件系统操作工具
// 提供对 vault 中文件和目录的基本操作

import type { Page, Block } from '../types';
import { pageToMarkdown, markdownToPage } from './markdownConverter';

// ==================== 目录操作 ====================

// 确保目录存在（如果不存在则创建）
export async function ensureDirectory(
  parentHandle: FileSystemDirectoryHandle,
  dirName: string
): Promise<FileSystemDirectoryHandle> {
  try {
    return await parentHandle.getDirectoryHandle(dirName, { create: true });
  } catch (error) {
    throw new Error(`无法创建目录 "${dirName}": ${error}`);
  }
}

// 列出目录中的所有文件
export async function listFiles(
  dirHandle: FileSystemDirectoryHandle,
  pattern?: RegExp
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        if (!pattern || pattern.test(entry.name)) {
          files.push(entry as FileSystemFileHandle);
        }
      }
    }
  } catch (error) {
    console.error('列出文件失败:', error);
    throw new Error('无法读取目录内容');
  }

  return files;
}

// 列出目录中的所有子目录
export async function listDirectories(
  dirHandle: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle[]> {
  const directories: FileSystemDirectoryHandle[] = [];

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        directories.push(entry as FileSystemDirectoryHandle);
      }
    }
  } catch (error) {
    console.error('列出目录失败:', error);
    throw new Error('无法读取子目录');
  }

  return directories;
}

// 检查文件或目录是否存在
export async function exists(
  parentHandle: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await parentHandle.getFileHandle(name);
    return true;
  } catch {
    try {
      await parentHandle.getDirectoryHandle(name);
      return true;
    } catch {
      return false;
    }
  }
}

// ==================== 文件读写操作 ====================

// 读取页面文件
export async function readPageFile(
  fileHandle: FileSystemFileHandle
): Promise<{ page: Partial<Page>; blocks: Block[] }> {
  try {
    const file = await fileHandle.getFile();
    const content = await file.text();
    return markdownToPage(content, fileHandle.name);
  } catch (error) {
    console.error('读取页面文件失败:', fileHandle.name, error);
    throw new Error(`无法读取文件 "${fileHandle.name}"`);
  }
}

// 写入页面文件
export async function writePageFile(
  dirHandle: FileSystemDirectoryHandle,
  page: Page,
  blocks: Block[]
): Promise<void> {
  try {
    const filename = generateFilename(page);
    const content = pageToMarkdown(page, blocks);

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(content);
    await writable.close();
  } catch (error) {
    console.error('写入页面文件失败:', page.title, error);
    throw new Error(`无法写入文件 "${page.title}"`);
  }
}

// 删除文件
export async function deleteFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string
): Promise<void> {
  try {
    await dirHandle.removeEntry(filename);
  } catch (error) {
    console.error('删除文件失败:', filename, error);
    throw new Error(`无法删除文件 "${filename}"`);
  }
}

// 读取文本文件
export async function readTextFile(
  fileHandle: FileSystemFileHandle
): Promise<string> {
  try {
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (error) {
    console.error('读取文件失败:', fileHandle.name, error);
    throw new Error(`无法读取文件 "${fileHandle.name}"`);
  }
}

// 写入文本文件
export async function writeTextFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  content: string
): Promise<void> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    
    await writable.write(content);
    await writable.close();
  } catch (error) {
    console.error('写入文件失败:', filename, error);
    throw new Error(`无法写入文件 "${filename}"`);
  }
}

// ==================== Vault 结构管理 ====================

// 初始化 vault 结构
export async function initializeVaultStructure(
  vaultHandle: FileSystemDirectoryHandle
): Promise<void> {
  try {
    // 创建必要的目录
    await ensureDirectory(vaultHandle, 'pages');
    await ensureDirectory(vaultHandle, 'journals');
    await ensureDirectory(vaultHandle, '.notesdb');

    // 创建配置文件
    const config = {
      version: '1.0.0',
      created: new Date().toISOString(),
      appName: 'AI Outline Notes',
    };

    await writeTextFile(
      await vaultHandle.getDirectoryHandle('.notesdb'),
      'config.json',
      JSON.stringify(config, null, 2)
    );

    console.log('✅ Vault 结构初始化完成');
  } catch (error) {
    console.error('初始化 vault 结构失败:', error);
    throw new Error('无法初始化文件夹结构');
  }
}

// 获取页面文件应该存储的目录
export function getPageDirectory(page: Page): 'pages' | 'journals' {
  return page.type === 'daily' ? 'journals' : 'pages';
}

// 生成文件名
export function generateFilename(page: Page): string {
  if (page.type === 'daily') {
    // 日记使用日期作为文件名
    return `${page.title}.md`;
  } else {
    // 普通页面：清理标题，移除特殊字符
    const safeName = page.title
      .replace(/[\/\\:*?"<>|]/g, '') // 移除文件系统不允许的字符
      .replace(/\s+/g, '-')           // 空格转为连字符
      .trim();
    return `${safeName}.md`;
  }
}

// 从文件名解析页面类型
export function parsePageType(filename: string, directory: string): 'note' | 'daily' {
  if (directory === 'journals') {
    return 'daily';
  }
  
  // 检查文件名是否符合日期格式 YYYY-MM-DD
  const datePattern = /^\d{4}-\d{2}-\d{2}\.md$/;
  if (datePattern.test(filename)) {
    return 'daily';
  }
  
  return 'note';
}

// ==================== 文件元数据 ====================

// 获取文件的最后修改时间
export async function getFileModifiedTime(
  fileHandle: FileSystemFileHandle
): Promise<number> {
  try {
    const file = await fileHandle.getFile();
    return file.lastModified;
  } catch (error) {
    console.error('获取文件修改时间失败:', fileHandle.name, error);
    return 0;
  }
}

// 获取文件大小
export async function getFileSize(
  fileHandle: FileSystemFileHandle
): Promise<number> {
  try {
    const file = await fileHandle.getFile();
    return file.size;
  } catch (error) {
    console.error('获取文件大小失败:', fileHandle.name, error);
    return 0;
  }
}

// ==================== 批量操作 ====================

// 读取目录中所有页面文件
export async function readAllPagesFromDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<{ page: Partial<Page>; blocks: Block[] }>> {
  const files = await listFiles(dirHandle, /\.md$/);
  const results: Array<{ page: Partial<Page>; blocks: Block[] }> = [];

  for (const fileHandle of files) {
    try {
      const data = await readPageFile(fileHandle);
      results.push(data);
    } catch (error) {
      console.error(`跳过无法读取的文件: ${fileHandle.name}`, error);
    }
  }

  return results;
}

// 获取 vault 统计信息
export async function getVaultStats(
  vaultHandle: FileSystemDirectoryHandle
): Promise<{
  totalPages: number;
  totalJournals: number;
  totalFiles: number;
}> {
  try {
    const pagesDir = await vaultHandle.getDirectoryHandle('pages', { create: false });
    const journalsDir = await vaultHandle.getDirectoryHandle('journals', { create: false });

    const pagesFiles = await listFiles(pagesDir, /\.md$/);
    const journalsFiles = await listFiles(journalsDir, /\.md$/);

    return {
      totalPages: pagesFiles.length,
      totalJournals: journalsFiles.length,
      totalFiles: pagesFiles.length + journalsFiles.length,
    };
  } catch (error) {
    console.error('获取 vault 统计失败:', error);
    return {
      totalPages: 0,
      totalJournals: 0,
      totalFiles: 0,
    };
  }
}

