// 侧边栏 - 页面列表
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus, Calendar, Search, Folder, RefreshCw, Settings, Clock } from 'lucide-react';
import { db } from '../../db/database';
import { createPage, getTodayDaily, getRecentPages } from '../../utils/pageUtils';
import { getVaultHandle, getVaultName, clearVaultHandle, isFileSystemSupported } from '../../lib/fileSystem';
import { getSyncEngine } from '../../lib/syncEngine';
import type { SyncState } from '../../lib/syncEngine';

interface SidebarProps {
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPageId,
  onPageSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultName, setVaultName] = useState<string>('');
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // 加载 vault 信息
  useEffect(() => {
    const loadVaultInfo = async () => {
      if (!isFileSystemSupported()) return;

      const handle = await getVaultHandle();
      if (handle) {
        setVaultName(getVaultName(handle));
        
        // 监听同步状态
        const syncEngine = getSyncEngine();
        const unsubscribe = syncEngine.onStateChange(setSyncState);
        
        return unsubscribe;
      }
    };

    const unsubscribe = loadVaultInfo();
    return () => {
      unsubscribe?.then(fn => fn?.());
    };
  }, []);

  // 实时查询所有页面
  const pages = useLiveQuery(
    () => db.pages.orderBy('updatedAt').reverse().toArray(),
    []
  );

  // 实时查询最近访问的页面
  const recentPages = useLiveQuery(
    async () => {
      const pages = await getRecentPages(5);
      return pages;
    },
    []
  );

  const filteredPages = pages
    ?.filter(page => !page.isReference)
    .filter(page =>
      page.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleCreatePage = async () => {
    const title = prompt('输入页面标题：');
    if (title) {
      const page = await createPage(title);
      onPageSelect(page.id);
    }
  };

  const handleOpenToday = async () => {
    const todayPage = await getTodayDaily();
    onPageSelect(todayPage.id);
  };

  const handleManualSync = async () => {
    try {
      const syncEngine = getSyncEngine();
      await syncEngine.fullSync();
    } catch (error) {
      console.error('手动同步失败:', error);
      alert('同步失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  const handleChangeVault = async () => {
    if (confirm('切换笔记库会关闭当前笔记，确定继续吗？')) {
      await clearVaultHandle();
      window.location.reload();
    }
  };

  return (
    <div className="w-64 h-full bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border-strong)] flex flex-col transition-colors duration-200">
      {/* 头部 */}
      <div className="p-4 border-b border-[var(--color-border-strong)]">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">AI 大纲笔记</h1>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索页面..."
            className="w-full pl-9 pr-3 py-2 border border-[var(--color-input-border)] rounded-md text-sm bg-[var(--color-input-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)] transition-colors duration-200"
          />
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="p-2 border-b border-[var(--color-border-strong)] space-y-1">
        <button
          onClick={handleOpenToday}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--color-text-primary)]
                   hover:bg-[var(--color-sidebar-hover)] rounded-md transition-colors duration-200"
        >
          <Calendar className="w-4 h-4" />
          <span className="text-sm">今日日记</span>
        </button>

        <button
          onClick={handleCreatePage}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--color-text-primary)]
                   hover:bg-[var(--color-sidebar-hover)] rounded-md transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">新建页面</span>
        </button>
      </div>

      {/* 最近使用 */}
      {recentPages && recentPages.length > 0 && (
        <div className="p-2 border-b border-[var(--color-border-strong)]">
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            <Clock className="w-3 h-3" />
            <span>最近使用</span>
          </div>
          <div className="space-y-1">
            {recentPages.map(page => (
              <button
                key={page.id}
                onClick={() => onPageSelect(page.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md
                         transition-colors duration-200 group ${
                  currentPageId === page.id
                    ? 'bg-[var(--color-list-active-bg)] text-[var(--color-list-active-text)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-hover)]'
                }`}
              >
                {page.type === 'daily' ? (
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{page.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 页面列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredPages?.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] text-sm mt-4">
            {searchQuery ? '没有找到匹配的页面' : '还没有页面'}
          </div>
        ) : (
          filteredPages?.map(page => (
            <button
              key={page.id}
              onClick={() => onPageSelect(page.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md 
                       transition-colors duration-200 mb-1 group ${
                currentPageId === page.id
                  ? 'bg-[var(--color-list-active-bg)] text-[var(--color-list-active-text)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-hover)]'
              }`}
            >
              {page.type === 'daily' ? (
                <Calendar className="w-4 h-4 flex-shrink-0" />
              ) : (
                <FileText className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm truncate flex-1">{page.title}</span>
            </button>
          ))
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-4 border-t border-[var(--color-border-strong)] space-y-3">
        {/* Vault 信息 */}
        {vaultName && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Folder className="w-3 h-3" />
              <span className="truncate" title={vaultName}>{vaultName}</span>
            </div>

            {/* 同步状态 */}
            {syncState && (
              <div className="flex items-center gap-2 text-xs">
                {syncState.status === 'syncing' && (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                    <span className="text-blue-500">{syncState.message}</span>
                  </>
                )}
                {syncState.status === 'success' && (
                  <span className="text-green-500">✓ 已同步</span>
                )}
                {syncState.status === 'error' && (
                  <span className="text-red-500">✗ 同步错误</span>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleManualSync}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] bg-[var(--color-button-bg)] text-[var(--color-button-text)] hover:bg-[var(--color-button-hover)] transition-colors"
                title="手动同步"
              >
                <RefreshCw className="w-3 h-3" />
                <span>同步</span>
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center justify-center px-2 py-1.5 text-xs rounded border border-[var(--color-border-subtle)] bg-[var(--color-button-bg)] text-[var(--color-button-text)] hover:bg-[var(--color-button-hover)] transition-colors"
                title="设置"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>

            {/* 设置菜单 */}
            {showSettings && (
              <div className="absolute bottom-16 left-4 right-4 bg-[var(--color-popover-bg)] border border-[var(--color-popover-border)] rounded-md shadow-lg p-2 z-50">
                <button
                  onClick={handleChangeVault}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-hover)] rounded transition-colors"
                >
                  切换笔记库
                </button>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-[var(--color-text-muted)]">
          <p>共 {filteredPages?.length || 0} 个页面</p>
        </div>
      </div>
    </div>
  );
};
