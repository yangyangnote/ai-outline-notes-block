// 页面标签页容器
import React, { useState } from 'react';
import { FileText, List } from 'lucide-react';
import { AllPagesTab } from './AllPagesTab';
import { OutlineEditor } from '../Editor/OutlineEditor';

interface PageTabsContainerProps {
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
  onBlockSelect?: (blockId: string | null, content: string) => void;
  onNavigateToPage?: (pageId: string) => void;
}

type TabType = 'editor' | 'all';

export const PageTabsContainer: React.FC<PageTabsContainerProps> = ({
  currentPageId,
  onPageSelect,
  onBlockSelect,
  onNavigateToPage,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('editor');

  return (
    <div className="h-full flex flex-col bg-[var(--color-app-bg)]">
      {/* 标签页导航 */}
      <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--color-toolbar-bg)]">
        <div className="flex items-center px-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-subtle)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>编辑器</span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-subtle)]'
            }`}
          >
            <List className="w-4 h-4" />
            <span>全部</span>
          </button>
        </div>
      </div>

      {/* 标签页内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'editor' ? (
          currentPageId ? (
            <OutlineEditor
              pageId={currentPageId}
              onBlockSelect={onBlockSelect}
              onNavigateToPage={onNavigateToPage || onPageSelect}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)]">
              请选择或创建一个页面开始编辑
            </div>
          )
        ) : (
          <AllPagesTab
            onPageSelect={onPageSelect}
            currentPageId={currentPageId}
          />
        )}
      </div>
    </div>
  );
};
