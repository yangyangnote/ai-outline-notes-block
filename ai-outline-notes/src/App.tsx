// 主应用组件
import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Sun, Moon } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { OutlineEditor } from './components/Editor/OutlineEditor';
import { AIPanel } from './components/AIPanel/AIPanel';
import { VaultSelector } from './components/VaultSelector/VaultSelector';
import { initializeDatabase, db } from './db/database';
import { cleanupDuplicatePages } from './utils/dbMaintenance';
import { initDevTools } from './utils/devTools';
import { getVaultHandle, isFileSystemSupported } from './lib/fileSystem';
import { getSyncEngine } from './lib/syncEngine';
import type { Page } from './types';

function App() {
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedBlockContent, setSelectedBlockContent] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [vaultHandle, setVaultHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = localStorage.getItem('things-theme');
    const resolved =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    const root = document.documentElement;
    root.classList.remove('theme-things-light', 'theme-things-dark');
    root.classList.add(resolved === 'dark' ? 'theme-things-dark' : 'theme-things-light');
    return resolved;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-things-light', 'theme-things-dark');
    const themeClass = theme === 'dark' ? 'theme-things-dark' : 'theme-things-light';
    root.classList.add(themeClass);
    localStorage.setItem('things-theme', theme);
  }, [theme]);

  // 检查并加载已保存的 vault
  useEffect(() => {
    const loadVault = async () => {
      try {
        // 检查浏览器是否支持文件系统 API
        if (!isFileSystemSupported()) {
          console.warn('浏览器不支持文件系统访问，使用 IndexedDB 模式');
          setVaultHandle(null);
          setIsLoadingVault(false);
          return;
        }

        // 尝试加载已保存的 vault
        const savedHandle = await getVaultHandle();
        if (savedHandle) {
          console.log('✅ 加载已保存的 vault:', savedHandle.name);
          setVaultHandle(savedHandle);
        }
      } catch (error) {
        console.error('加载 vault 失败:', error);
      } finally {
        setIsLoadingVault(false);
      }
    };

    loadVault();
  }, []);

  // 初始化数据库和同步
  useEffect(() => {
    // 如果还在加载 vault，等待
    if (isLoadingVault) {
      return;
    }

    const init = async () => {
      await initializeDatabase();
      
      // 清理重复的页面（如果有）
      await cleanupDuplicatePages();
      
      // 加载开发工具（仅开发环境）
      if (import.meta.env.DEV) {
        initDevTools();
      }

      // 如果有 vault，进行同步
      if (vaultHandle) {
        try {
          const syncEngine = getSyncEngine();
          await syncEngine.initialize(vaultHandle);
          await syncEngine.fullSync();
          syncEngine.startWatching();
        } catch (error) {
          console.error('同步失败:', error);
        }
      }
      
      // 加载第一个页面
      const pages = await db.pages.orderBy('updatedAt').reverse().limit(1).toArray();
      if (pages.length > 0) {
        setCurrentPageId(pages[0].id);
      }
      
      setIsInitialized(true);
    };
    
    init();
  }, [vaultHandle, isLoadingVault]);

  // 加载当前页面信息
  useEffect(() => {
    if (currentPageId) {
      db.pages.get(currentPageId).then(page => {
        if (page) {
          setCurrentPage(page);
        }
      });
    }
  }, [currentPageId]);

  const handlePageSelect = useCallback((pageId: string) => {
    setCurrentPageId(pageId);
    setSelectedBlockContent(''); // 切换页面时清空选中内容
  }, []);

  const handleBlockSelect = useCallback((_blockId: string | null, content: string) => {
    setSelectedBlockContent(content);
  }, []);

  const handleVaultSelected = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setVaultHandle(handle);
    // 重新初始化以触发同步
    setIsInitialized(false);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // 加载 vault 中
  if (isLoadingVault) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-app-bg)] transition-colors">
        <div className="text-[var(--color-text-secondary)]">加载中...</div>
      </div>
    );
  }

  // 支持文件系统但未选择 vault
  if (isFileSystemSupported() && !vaultHandle) {
    return <VaultSelector onVaultSelected={handleVaultSelected} />;
  }

  // 数据库初始化中
  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-app-bg)] transition-colors">
        <div className="text-[var(--color-text-secondary)]">
          {vaultHandle ? '同步数据中...' : '初始化中...'}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--color-app-bg)] text-[var(--color-text-primary)] transition-colors duration-200">
      {/* 浏览器不支持文件系统时的提示 */}
      {!isFileSystemSupported() && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
            ⚠️ 当前浏览器不支持文件系统访问，使用 IndexedDB 存储模式。建议使用 Chrome 或 Edge 获得完整功能。
          </p>
        </div>
      )}
      
      {/* 左侧边栏 */}
      <Sidebar
        currentPageId={currentPageId}
        onPageSelect={handlePageSelect}
      />

      {/* 主编辑区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-14 bg-[var(--color-toolbar-bg)] border-b border-[var(--color-border-subtle)] flex items-center justify-between px-6 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {currentPage?.title || '选择一个页面'}
            </h2>
            {currentPage && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                {currentPage.type === 'daily' ? '日记' : '笔记'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-button-bg)] text-[var(--color-button-text)] hover:bg-[var(--color-button-hover)] transition-colors duration-200"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  <span className="text-sm">浅色模式</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  <span className="text-sm">深色模式</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 ${
                isAIPanelOpen
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-ai-button-inactive-bg)] text-[var(--color-ai-button-inactive-text)] hover:bg-[var(--color-button-hover)]'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>AI 助手</span>
            </button>
          </div>
        </div>

        {/* 编辑器 */}
        <div className="flex-1 overflow-hidden">
          {currentPageId ? (
            <OutlineEditor
              pageId={currentPageId}
              onBlockSelect={handleBlockSelect}
              onNavigateToPage={handlePageSelect}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)]">
              请选择或创建一个页面开始编辑
            </div>
          )}
        </div>
      </div>

      {/* AI 对话面板 */}
      <AIPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        currentPageId={currentPageId}
        currentPageTitle={currentPage?.title || ''}
        selectedBlockContent={selectedBlockContent}
      />
    </div>
  );
}

export default App;
