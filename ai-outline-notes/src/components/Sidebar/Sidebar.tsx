// 侧边栏 - 页面列表
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus, Calendar, Folder, RefreshCw, Settings, Clock, List } from 'lucide-react';
import { db } from '../../db/database';
import { createPage, getRecentPages } from '../../utils/pageUtils';
import { getVaultHandle, getVaultName, clearVaultHandle, isFileSystemSupported } from '../../lib/fileSystem';
import { getSyncEngine } from '../../lib/syncEngine';
import type { SyncState } from '../../lib/syncEngine';

interface SidebarProps {
  currentPageId: string | null;
  onPageSelect: (pageId: string, shouldRecordVisit?: boolean) => void;
  onViewChange?: (view: 'editor' | 'allPages') => void;
  currentView?: 'editor' | 'allPages';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPageId,
  onPageSelect,
  onViewChange,
  currentView = 'editor',
}) => {
  const [vaultName, setVaultName] = useState<string>('');
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');

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

  // 实时查询最近访问的页面（添加 currentPageId 作为依赖，确保切换页面时更新）
  const recentPages = useLiveQuery(
    async () => {
      const pages = await getRecentPages(5);
      return pages;
    },
    [currentPageId]
  );

  // 实时查询总页面数（用于底部显示）
  const totalPagesCount = useLiveQuery(
    async () => {
      const allPages = await db.pages.toArray();
      const nonReferencePages = allPages.filter(page => !page.isReference);
      return nonReferencePages.length;
    },
    []
  );

  const handleCreatePage = async () => {
    setShowNewPageDialog(true);
  };

  const handleConfirmNewPage = async () => {
    const title = newPageTitle.trim();
    if (title) {
      try {
        const page = await createPage(title);
        onPageSelect(page.id);
        setShowNewPageDialog(false);
        setNewPageTitle('');
      } catch (error) {
        console.error('创建页面失败:', error);
        alert('创建页面失败：' + (error instanceof Error ? error.message : '未知错误'));
      }
    }
  };

  const handleCancelNewPage = () => {
    setShowNewPageDialog(false);
    setNewPageTitle('');
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
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">AI 大纲笔记</h1>
      </div>

      {/* 快捷操作 */}
      <div className="p-2 border-b border-[var(--color-border-strong)] space-y-1">
        <button
          type="button"
          onClick={handleCreatePage}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--color-text-primary)]
                   hover:bg-[var(--color-sidebar-hover)] rounded-md transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">新建页面</span>
        </button>

        <button
          onClick={() => onViewChange?.('allPages')}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md transition-colors duration-200 ${
            currentView === 'allPages'
              ? 'bg-[var(--color-list-active-bg)] text-[var(--color-list-active-text)]'
              : 'text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-hover)]'
          }`}
        >
          <List className="w-4 h-4" />
          <span className="text-sm">全部页面</span>
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
                onClick={() => onPageSelect(page.id, false)}
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

      {/* 占位区域 */}
      <div className="flex-1 overflow-y-auto p-2">
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
          <p>共 {totalPagesCount || 0} 个页面</p>
        </div>
      </div>

      {/* 新建页面对话框 */}
      {showNewPageDialog && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={handleCancelNewPage}
          >
            <div
              className="bg-[var(--color-popover-bg)] rounded-lg shadow-xl p-6 w-96 max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">新建页面</h2>
              <input
                type="text"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmNewPage();
                  } else if (e.key === 'Escape') {
                    handleCancelNewPage();
                  }
                }}
                placeholder="输入页面标题"
                autoFocus
                className="w-full px-3 py-2 border border-[var(--color-border-subtle)] rounded-md bg-[var(--color-editor-bg)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handleCancelNewPage}
                  className="px-4 py-2 text-sm rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-button-bg)] text-[var(--color-button-text)] hover:bg-[var(--color-button-hover)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmNewPage}
                  disabled={!newPageTitle.trim()}
                  className="px-4 py-2 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
