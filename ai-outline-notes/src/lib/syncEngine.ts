// 双向同步引擎
// 负责在文件系统和 IndexedDB 之间同步数据

import { db } from '../db/database';
import type { Page, Block } from '../types';
import {
  readPageFile,
  writePageFile,
  listFiles,
  getPageDirectory,
  getFileModifiedTime,
  generateFilename,
  readAllPagesFromDirectory,
} from '../utils/fileOperations';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export interface SyncState {
  status: SyncStatus;
  message: string;
  lastSyncTime: number | null;
  filesScanned: number;
  filesSynced: number;
}

export class SyncEngine {
  private vaultHandle: FileSystemDirectoryHandle | null = null;
  private syncState: SyncState = {
    status: 'idle',
    message: '',
    lastSyncTime: null,
    filesScanned: 0,
    filesSynced: 0,
  };
  private watcherInterval: number | null = null;
  private readonly WATCH_INTERVAL = 5000; // 5 秒检查一次
  private fileCache: Map<string, number> = new Map(); // filename -> lastModified

  // 状态变更监听器
  private listeners: Array<(state: SyncState) => void> = [];

  // ==================== 初始化 ====================

  async initialize(vaultHandle: FileSystemDirectoryHandle): Promise<void> {
    this.vaultHandle = vaultHandle;
    console.log('🔄 同步引擎已初始化:', vaultHandle.name);
  }

  // ==================== 完整同步 ====================

  async fullSync(): Promise<void> {
    if (!this.vaultHandle) {
      throw new Error('Vault 未初始化');
    }

    this.updateState({
      status: 'syncing',
      message: '开始完整同步...',
      filesScanned: 0,
      filesSynced: 0,
    });

    try {
      // 1. 从文件系统读取所有数据
      await this.syncFromFileSystem();

      // 2. 将数据库中的数据写入文件系统（处理仅存在于数据库中的页面）
      await this.syncDatabaseToFiles();

      this.updateState({
        status: 'success',
        message: '同步完成',
        lastSyncTime: Date.now(),
      });

      console.log('✅ 完整同步完成');
    } catch (error) {
      console.error('完整同步失败:', error);
      this.updateState({
        status: 'error',
        message: error instanceof Error ? error.message : '同步失败',
      });
      throw error;
    }
  }

  // ==================== 文件系统 → IndexedDB ====================

  async syncFromFileSystem(): Promise<void> {
    if (!this.vaultHandle) {
      throw new Error('Vault 未初始化');
    }

    try {
      const pagesDir = await this.vaultHandle.getDirectoryHandle('pages', { create: true });
      const journalsDir = await this.vaultHandle.getDirectoryHandle('journals', { create: true });

      // 读取所有页面
      const pagesData = await readAllPagesFromDirectory(pagesDir);
      const journalsData = await readAllPagesFromDirectory(journalsDir);

      const allData = [...pagesData, ...journalsData];
      
      this.updateState({
        filesScanned: allData.length,
        message: `扫描到 ${allData.length} 个文件...`,
      });

      let synced = 0;

      for (const { page, blocks } of allData) {
        try {
          await this.importPageToDatabase(page, blocks);
          synced++;
          
          this.updateState({
            filesSynced: synced,
            message: `正在同步... (${synced}/${allData.length})`,
          });
        } catch (error) {
          console.error('导入页面失败:', page.title, error);
        }
      }

      console.log(`✅ 从文件系统同步了 ${synced} 个页面`);
    } catch (error) {
      console.error('从文件系统同步失败:', error);
      throw error;
    }
  }

  // ==================== IndexedDB → 文件系统 ====================

  async syncToFileSystem(pageId: string): Promise<void> {
    if (!this.vaultHandle) {
      throw new Error('Vault 未初始化');
    }

    try {
      // 获取页面和块
      const page = await db.pages.get(pageId);
      if (!page) {
        console.warn('页面不存在:', pageId);
        return;
      }

      const blocks = await db.blocks.where({ pageId }).toArray();

      // 确定目标目录
      const dirName = getPageDirectory(page);
      const dirHandle = await this.vaultHandle.getDirectoryHandle(dirName, { create: true });

      // 写入文件
      await writePageFile(dirHandle, page, blocks);

      // 更新缓存
      const filename = generateFilename(page);
      const fileHandle = await dirHandle.getFileHandle(filename);
      const modifiedTime = await getFileModifiedTime(fileHandle);
      this.fileCache.set(`${dirName}/${filename}`, modifiedTime);

      console.log('✅ 页面已同步到文件系统:', page.title);
    } catch (error) {
      console.error('同步到文件系统失败:', pageId, error);
      throw error;
    }
  }

  // 将数据库中所有页面同步到文件系统
  async syncDatabaseToFiles(): Promise<void> {
    if (!this.vaultHandle) {
      throw new Error('Vault 未初始化');
    }

    try {
      const pages = await db.pages.toArray();
      
      for (const page of pages) {
        await this.syncToFileSystem(page.id);
      }

      console.log(`✅ 数据库中 ${pages.length} 个页面已同步到文件系统`);
    } catch (error) {
      console.error('同步数据库到文件系统失败:', error);
      throw error;
    }
  }

  // ==================== 文件变更监听 ====================

  startWatching(): void {
    if (this.watcherInterval) {
      return; // 已经在监听
    }

    this.watcherInterval = window.setInterval(() => {
      void this.checkForChanges();
    }, this.WATCH_INTERVAL);

    console.log('👁️ 开始监听文件变更');
  }

  stopWatching(): void {
    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
      this.watcherInterval = null;
      console.log('⏹️ 停止监听文件变更');
    }
  }

  private async checkForChanges(): Promise<void> {
    if (!this.vaultHandle) return;

    try {
      const pagesDir = await this.vaultHandle.getDirectoryHandle('pages', { create: false });
      const journalsDir = await this.vaultHandle.getDirectoryHandle('journals', { create: false });

      await this.checkDirectoryForChanges(pagesDir, 'pages');
      await this.checkDirectoryForChanges(journalsDir, 'journals');
    } catch (error) {
      console.error('检查文件变更失败:', error);
    }
  }

  private async checkDirectoryForChanges(
    dirHandle: FileSystemDirectoryHandle,
    dirName: string
  ): Promise<void> {
    const files = await listFiles(dirHandle, /\.md$/);

    for (const fileHandle of files) {
      const key = `${dirName}/${fileHandle.name}`;
      const currentModified = await getFileModifiedTime(fileHandle);
      const cachedModified = this.fileCache.get(key);

      if (cachedModified === undefined || currentModified > cachedModified) {
        // 文件有变更
        console.log('📝 检测到文件变更:', fileHandle.name);
        
        try {
          const { page, blocks } = await readPageFile(fileHandle);
          await this.importPageToDatabase(page, blocks);
          this.fileCache.set(key, currentModified);
        } catch (error) {
          console.error('处理文件变更失败:', fileHandle.name, error);
        }
      }
    }
  }

  // ==================== 数据导入 ====================

  private async importPageToDatabase(
    pageData: Partial<Page>,
    blocks: Block[]
  ): Promise<void> {
    if (!pageData.id) {
      console.warn('页面缺少 ID，跳过导入');
      return;
    }

    // 检查页面是否已存在
    const existingPage = await db.pages.get(pageData.id);

    if (existingPage) {
      // 更新现有页面（使用文件的数据）
      await db.pages.update(pageData.id, {
        title: pageData.title || existingPage.title,
        type: pageData.type || existingPage.type,
        updatedAt: pageData.updatedAt || Date.now(),
      });
    } else {
      // 创建新页面
      const page: Page = {
        id: pageData.id,
        title: pageData.title || '未命名',
        type: pageData.type || 'note',
        isReference: pageData.isReference || false,
        createdAt: pageData.createdAt || Date.now(),
        updatedAt: pageData.updatedAt || Date.now(),
      };
      await db.pages.add(page);
    }

    // 更新块
    // 删除旧块
    await db.blocks.where({ pageId: pageData.id }).delete();
    
    // 添加新块
    if (blocks.length > 0) {
      await db.blocks.bulkAdd(blocks);
    }
  }

  // ==================== 冲突处理 ====================

  async detectConflicts(pageId: string): Promise<boolean> {
    if (!this.vaultHandle) return false;

    try {
      const page = await db.pages.get(pageId);
      if (!page) return false;

      const dirName = getPageDirectory(page);
      const dirHandle = await this.vaultHandle.getDirectoryHandle(dirName, { create: false });
      const filename = generateFilename(page);

      try {
        const fileHandle = await dirHandle.getFileHandle(filename);
        const fileModified = await getFileModifiedTime(fileHandle);
        const dbModified = page.updatedAt;

        // 如果文件修改时间晚于数据库，可能有冲突
        return fileModified > dbModified;
      } catch {
        // 文件不存在，不算冲突
        return false;
      }
    } catch (error) {
      console.error('检测冲突失败:', error);
      return false;
    }
  }

  async resolveConflict(
    pageId: string,
    strategy: 'file' | 'database' | 'merge'
  ): Promise<void> {
    if (strategy === 'file') {
      // 文件优先：从文件系统重新加载
      await this.syncFromFileSystem();
    } else if (strategy === 'database') {
      // 数据库优先：覆盖文件
      await this.syncToFileSystem(pageId);
    } else {
      // 合并策略：创建冲突副本
      // TODO: 实现更复杂的合并逻辑
      console.warn('合并策略尚未实现');
    }
  }

  // ==================== 状态管理 ====================

  getState(): SyncState {
    return { ...this.syncState };
  }

  onStateChange(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private updateState(updates: Partial<SyncState>): void {
    this.syncState = { ...this.syncState, ...updates };
    this.listeners.forEach(listener => listener(this.syncState));
  }

  // ==================== 清理 ====================

  destroy(): void {
    this.stopWatching();
    this.listeners = [];
    this.fileCache.clear();
    console.log('🗑️ 同步引擎已销毁');
  }
}

// 全局同步引擎实例
let globalSyncEngine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!globalSyncEngine) {
    globalSyncEngine = new SyncEngine();
  }
  return globalSyncEngine;
}

export function destroySyncEngine(): void {
  if (globalSyncEngine) {
    globalSyncEngine.destroy();
    globalSyncEngine = null;
  }
}

