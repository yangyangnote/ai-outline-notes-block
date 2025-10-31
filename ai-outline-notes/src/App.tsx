// 主应用组件
import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Sun, Moon, MoreHorizontal, Trash2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { OutlineEditor } from './components/Editor/OutlineEditor';
import { AllPagesTab } from './components/PageTabs/AllPagesTab';
import { AIPanel } from './components/AIPanel/AIPanel';
import { VaultSelector } from './components/VaultSelector/VaultSelector';
import { initializeDatabase, db } from './db/database';
import { cleanupDuplicatePages } from './utils/dbMaintenance';
import { initDevTools } from './utils/devTools';
import { getVaultHandle, isFileSystemSupported } from './lib/fileSystem';
import { getSyncEngine } from './lib/syncEngine';
import { recordPageVisit, deletePage } from './utils/pageUtils';
import type { Page } from './types';

function App() {
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'allPages'>('editor');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedBlockContent, setSelectedBlockContent] = useState<string>('');
  const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsPageMenuOpen(false);
  }, [currentPageId]);

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

  const recordVisit = useCallback((pageId: string) => {
    recordPageVisit(pageId).catch(err => {
      console.error('记录页面访问失败:', err);
    });
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
        const initialPageId = pages[0].id;
        setCurrentPageId(initialPageId);
        recordVisit(initialPageId);
      }
      
      setIsInitialized(true);
    };
    
    init();
  }, [vaultHandle, isLoadingVault, recordVisit]);

  // 加载当前页面信息
  useEffect(() => {
    if (!currentPageId) {
      setCurrentPage(null);
      return;
    }

    let isCancelled = false;

    db.pages.get(currentPageId).then(page => {
      if (isCancelled) {
        return;
      }

      if (page) {
        setCurrentPage(page);
      } else {
        setCurrentPage(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentPageId]);

  const handlePageSelect = useCallback((pageId: string, shouldRecordVisit: boolean = true) => {
    setCurrentPageId(pageId);
    setSelectedBlockContent(''); // 切换页面时清空选中内容
    setViewMode('editor'); // 切换页面时返回编辑器视图
    if (shouldRecordVisit) {
      recordVisit(pageId);
    }
  }, [recordVisit]);

  const handleViewChange = useCallback((view: 'editor' | 'allPages') => {
    setViewMode(view);
  }, []);

  const handleBlockSelect = useCallback((_blockId: string | null, content: string) => {
    setSelectedBlockContent(content);
  }, []);

  const handleVaultSelected = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setVaultHandle(handle);
    // 重新初始化以触发同步
    setIsInitialized(false);
  }, []);

  const handleDeleteCurrentPage = useCallback(async () => {
    if (!currentPageId || !currentPage) {
      return;
    }

    const confirmMessage = `确定要删除页面「${currentPage.title}」吗？\n\n此操作将删除该页面及其所有内容，且无法撤销。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const deletedPageId = currentPageId;
      await deletePage(deletedPageId);
      setIsPageMenuOpen(false);
      setSelectedBlockContent('');

      const remainingPages = await db.pages.orderBy('updatedAt').reverse().toArray();
      const nextPage = remainingPages.find(page => page.id !== deletedPageId);

      if (nextPage) {
        setCurrentPageId(nextPage.id);
        recordVisit(nextPage.id);
      } else {
        setCurrentPageId(null);
        setCurrentPage(null);
      }
    } catch (error) {
      console.error('删除页面失败:', error);
      alert('删除页面失败，请重试');
    }
  }, [currentPageId, currentPage, recordVisit]);

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
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-app-bg)] text-[var(--color-text-primary)] transition-colors duration-200">
      {/* 顶部拖动栏 - Logseq 风格 */}
      <div
        className="titlebar-drag h-12 bg-[var(--color-toolbar-bg)] border-b border-[var(--color-border-subtle)] transition-colors duration-200 flex items-center justify-end"
        style={{
          // 为 macOS 红绿灯按钮留出空间（检测 macOS）
          paddingLeft: navigator.platform.toLowerCase().includes('mac') ? '80px' : '16px',
          paddingRight: '16px'
        }}
      >
        {/* 右侧按钮区域 */}
        <div className="titlebar-no-drag flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--color-button-hover)] transition-colors duration-200"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[var(--color-text-secondary)]" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </button>

          {currentPage && (
            <div className="relative">
              <button
                onClick={() => setIsPageMenuOpen(prev => !prev)}
                className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--color-button-hover)] transition-colors duration-200"
                title="页面操作"
              >
                <MoreHorizontal className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>

              {isPageMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsPageMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-[var(--color-popover-border)] bg-[var(--color-popover-bg)] py-2 shadow-lg transition-colors duration-200">
                    <button
                      onClick={handleDeleteCurrentPage}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-colors duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>删除页面</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors duration-200 ${
              isAIPanelOpen
                ? 'bg-[var(--color-accent)] text-white'
                : 'hover:bg-[var(--color-button-hover)] text-[var(--color-text-secondary)]'
            }`}
            title="AI 助手"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">AI</span>
          </button>
        </div>
      </div>

      {/* 浏览器不支持文件系统时的提示 */}
      {!isFileSystemSupported() && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
            ⚠️ 当前浏览器不支持文件系统访问，使用 IndexedDB 存储模式。建议使用 Chrome 或 Edge 获得完整功能。
          </p>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 */}
        <Sidebar
          currentPageId={currentPageId}
          onPageSelect={handlePageSelect}
          onViewChange={handleViewChange}
          currentView={viewMode}
        />

        {/* 主内容区 */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'allPages' ? (
            <AllPagesTab
              onPageSelect={handlePageSelect}
              currentPageId={currentPageId}
            />
          ) : currentPageId ? (
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

        {/* AI 对话面板 */}
        <AIPanel
          isOpen={isAIPanelOpen}
          onClose={() => setIsAIPanelOpen(false)}
          currentPageId={currentPageId}
          currentPageTitle={currentPage?.title || ''}
          selectedBlockContent={selectedBlockContent}
        />
      </div>
    </div>
  );
}

export default App;
