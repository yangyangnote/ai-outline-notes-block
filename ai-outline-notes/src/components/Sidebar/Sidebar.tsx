// 侧边栏 - 页面列表
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Plus, Calendar, Search } from 'lucide-react';
import { db } from '../../db/database';
import { createPage, getTodayDaily } from '../../utils/pageUtils';
import type { Page } from '../../types';

interface SidebarProps {
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPageId,
  onPageSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 实时查询所有页面
  const pages = useLiveQuery(
    () => db.pages.orderBy('updatedAt').reverse().toArray(),
    []
  );

  const filteredPages = pages?.filter(page =>
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
      <div className="p-4 border-t border-[var(--color-border-strong)] text-xs text-[var(--color-text-muted)]">
        <p>共 {pages?.length || 0} 个页面</p>
      </div>
    </div>
  );
};
