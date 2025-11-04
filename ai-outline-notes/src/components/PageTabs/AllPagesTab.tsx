// 全部页面标签页 - 表格布局
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../db/database';
import { getBacklinksCount } from '../../utils/pageUtils';

interface AllPagesTabProps {
  onPageSelect: (pageId: string, shouldRecordVisit?: boolean) => void;
  currentPageId: string | null;
}

type SortField = 'title' | 'backlinks' | 'created' | 'updated';
type SortDirection = 'asc' | 'desc';

export const AllPagesTab: React.FC<AllPagesTabProps> = ({
  onPageSelect,
  currentPageId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [backlinksCount, setBacklinksCount] = useState<Map<string, number>>(new Map());

  // 实时查询所有页面（直接查询，不使用依赖数组）
  const allPages = useLiveQuery(
    () => db.pages.toArray()
  );

  // 加载反向链接计数
  useEffect(() => {
    const loadBacklinksCount = async () => {
      const counts = await getBacklinksCount();
      setBacklinksCount(counts);
    };
    loadBacklinksCount();
  }, [allPages]);

  // 处理排序
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 过滤和排序页面
  const filteredAndSortedPages = React.useMemo(() => {
    if (!allPages) return [];

    // 过滤掉引用页面（但如果 isReference 是 undefined 则保留）
    let filtered = allPages.filter(page => page.isReference !== true);

    // 按搜索词过滤
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(page =>
        page.title.toLowerCase().includes(lowerQuery)
      );
    }

    // 排序
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'backlinks':
          comparison = (backlinksCount.get(a.id) || 0) - (backlinksCount.get(b.id) || 0);
          break;
        case 'created':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updated':
          comparison = a.updatedAt - b.updatedAt;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [allPages, searchQuery, sortField, sortDirection, backlinksCount]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-app-bg)]">
      {/* 工具栏 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            共计 {filteredAndSortedPages.length} 页面
          </h2>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索页面名称"
            className="w-full pl-9 pr-3 py-2 border border-[var(--color-input-border)] rounded-md text-sm bg-[var(--color-input-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)] transition-colors duration-200"
          />
        </div>
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        {filteredAndSortedPages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
            {searchQuery ? '没有找到匹配的页面' : '还没有页面'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[var(--color-toolbar-bg)] border-b border-[var(--color-border-subtle)] z-10">
              <tr>
                <th
                  onClick={() => handleSort('title')}
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide cursor-pointer hover:bg-[var(--color-sidebar-hover)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>页面名称</span>
                    <SortIcon field="title" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('backlinks')}
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide cursor-pointer hover:bg-[var(--color-sidebar-hover)] transition-colors"
                  style={{ width: '150px' }}
                >
                  <div className="flex items-center gap-2">
                    <span>双向链接</span>
                    <SortIcon field="backlinks" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('created')}
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide cursor-pointer hover:bg-[var(--color-sidebar-hover)] transition-colors"
                  style={{ width: '200px' }}
                >
                  <div className="flex items-center gap-2">
                    <span>创建日期</span>
                    <SortIcon field="created" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('updated')}
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide cursor-pointer hover:bg-[var(--color-sidebar-hover)] transition-colors"
                  style={{ width: '200px' }}
                >
                  <div className="flex items-center gap-2">
                    <span>更新日期</span>
                    <SortIcon field="updated" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPages.map((page, index) => (
                <tr
                  key={page.id}
                  onClick={() => onPageSelect(page.id)}
                  className={`border-b border-[var(--color-border-subtle)] cursor-pointer transition-colors ${
                    currentPageId === page.id
                      ? 'bg-[var(--color-list-active-bg)]'
                      : index % 2 === 0
                        ? 'bg-[var(--color-app-bg)] hover:bg-[var(--color-sidebar-hover)]'
                        : 'bg-[var(--color-sidebar-bg)] hover:bg-[var(--color-sidebar-hover)]'
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          currentPageId === page.id
                            ? 'text-[var(--color-list-active-text)]'
                            : 'text-[var(--color-text-primary)]'
                        }`}
                      >
                        {page.title}
                      </span>
                      {page.type === 'daily' && (
                        <span className="text-xs text-[var(--color-text-muted)] px-2 py-0.5 rounded bg-[var(--color-button-bg)]">
                          日记
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {backlinksCount.get(page.id) || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatDate(page.createdAt)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatDate(page.updatedAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
