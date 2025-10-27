import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { getLinkedReferences, getUnlinkedReferences } from '../../utils/pageUtils';
import type { ReferenceGroup } from '../../types';

const EMPTY_REFERENCE_GROUPS: ReferenceGroup[] = [];

interface BidirectionalReferencesProps {
  pageId: string;
  pageTitle: string;
  onNavigateToPage?: (pageId: string) => void;
  onLinkClick?: (title: string) => void;
}

const escapeRegExp = (value: string) =>
  value.replace(/[-/\\^$*+?.()|[\]{}]/g, match => `\\${match}`);

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const summarizeContent = (value: string): string => {
  const condensed = value.replace(/\s+/g, ' ').trim();
  if (!condensed) {
    return '（空白内容）';
  }
  if (condensed.length <= 120) {
    return condensed;
  }
  return `${condensed.slice(0, 117)}…`;
};

const renderPlainTextWithHighlight = (
  text: string,
  keyPrefix: string,
  highlightTitle?: string,
  highlightPlainMentions?: boolean
): React.ReactNode[] => {
  if (!text) {
    return [];
  }

  if (!highlightPlainMentions || !highlightTitle?.trim()) {
    return [
      <span key={`${keyPrefix}-plain`} className="whitespace-pre-wrap break-words">
        {text}
      </span>,
    ];
  }

  const normalizedHighlight = normalize(highlightTitle);
  const pattern = new RegExp(`(${escapeRegExp(highlightTitle.trim())})`, 'gi');
  const segments = text.split(pattern);

  return segments.map((segment, index) => {
    const key = `${keyPrefix}-segment-${index}`;

    if (!segment) {
      return null;
    }

    if (normalize(segment) === normalizedHighlight) {
      return (
        <span
          key={key}
          className="bg-[var(--color-link-hover-bg)] text-[var(--color-text-primary)] px-0.5 rounded-sm whitespace-pre-wrap break-words"
        >
          {segment}
        </span>
      );
    }

    return (
      <span key={key} className="whitespace-pre-wrap break-words">
        {segment}
      </span>
    );
  }).filter(Boolean) as React.ReactNode[];
};

interface RenderLinkedTextOptions {
  highlightTitle?: string;
  highlightPlainMentions?: boolean;
  onLinkClick?: (title: string) => void;
}

const renderLinkedText = (
  content: string,
  keyPrefix: string,
  options: RenderLinkedTextOptions
): React.ReactNode => {
  const { highlightTitle, highlightPlainMentions, onLinkClick } = options;
  const regex = /\[\[([^\]]+)\]\]/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentIndex = 0;
  const normalizedHighlight = highlightTitle ? normalize(highlightTitle) : undefined;

  while ((match = regex.exec(content)) !== null) {
    const matchIndex = match.index;
    const before = content.slice(lastIndex, matchIndex);

    if (before.length > 0) {
      const fragments = renderPlainTextWithHighlight(
        before,
        `${keyPrefix}-text-${segmentIndex}`,
        highlightTitle,
        highlightPlainMentions
      );
      elements.push(...fragments);
      segmentIndex++;
    }

    const rawTitle = match[1];
    const normalizedTitle = normalize(rawTitle);
    const isHighlight = Boolean(normalizedHighlight) && normalizedTitle === normalizedHighlight;

    elements.push(
      <button
        type="button"
        key={`${keyPrefix}-link-${segmentIndex}`}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          if (rawTitle.trim().length > 0) {
            onLinkClick?.(rawTitle.trim());
          }
        }}
        className={`inline-flex items-center rounded px-1.5 py-0.5 transition-colors duration-200 border border-transparent ${
          isHighlight
            ? 'bg-[var(--color-link-hover-bg)] text-[var(--color-link-text)] font-semibold'
            : 'bg-[var(--color-link-bg)] text-[var(--color-link-text)] hover:bg-[var(--color-link-hover-bg)]'
        }`}
        title={`跳转到页面：${rawTitle.trim() || rawTitle || ''}`}
      >
        {`[[${rawTitle.trim() || rawTitle || ''}]]`}
      </button>
    );
    segmentIndex++;

    lastIndex = regex.lastIndex;
  }

  const after = content.slice(lastIndex);
  if (after.length > 0) {
    const fragments = renderPlainTextWithHighlight(
      after,
      `${keyPrefix}-text-${segmentIndex}-end`,
      highlightTitle,
      highlightPlainMentions
    );
    elements.push(...fragments);
  }

  if (elements.length === 0) {
    return (
      <span className="whitespace-pre-wrap break-words">
        {content}
      </span>
    );
  }

  return elements;
};

const countBlocks = (groups: ReferenceGroup[]): number =>
  groups.reduce((total, group) => total + group.blocks.length, 0);

const filterGroupsByQuery = (groups: ReferenceGroup[], query: string): ReferenceGroup[] => {
  const trimmed = query.trim();
  if (!trimmed) {
    return groups;
  }

  const lowered = trimmed.toLocaleLowerCase();

  return groups
    .map(group => {
      const matchesPage = group.pageTitle.toLocaleLowerCase().includes(lowered);
      const matchingBlocks = group.blocks.filter(block => {
        if (matchesPage) {
          return true;
        }
        const blockContentMatch = block.blockContent.toLocaleLowerCase().includes(lowered);
        if (blockContentMatch) {
          return true;
        }
        return block.breadcrumbs.some(crumb => crumb.content.toLocaleLowerCase().includes(lowered));
      });

      if (matchingBlocks.length === 0) {
        return null;
      }

      return {
        pageId: group.pageId,
        pageTitle: group.pageTitle,
        blocks: matchingBlocks,
      };
    })
    .filter((group): group is ReferenceGroup => group !== null);
};

export const BidirectionalReferences: React.FC<BidirectionalReferencesProps> = ({
  pageId,
  pageTitle,
  onNavigateToPage,
  onLinkClick,
}) => {
  const [isLinkedExpanded, setIsLinkedExpanded] = useState(true);
  const [isUnlinkedExpanded, setIsUnlinkedExpanded] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  const liveLinkedReferences = useLiveQuery(
    () => (pageTitle ? getLinkedReferences(pageId, pageTitle) : EMPTY_REFERENCE_GROUPS),
    [pageId, pageTitle]
  );

  const linkedReferences = liveLinkedReferences ?? EMPTY_REFERENCE_GROUPS;

  const liveUnlinkedReferences = useLiveQuery(
    () => (pageTitle ? getUnlinkedReferences(pageId, pageTitle) : EMPTY_REFERENCE_GROUPS),
    [pageId, pageTitle]
  );

  const unlinkedReferences = liveUnlinkedReferences ?? EMPTY_REFERENCE_GROUPS;

  const totalLinkedCount = useMemo(() => countBlocks(linkedReferences), [linkedReferences]);
  const totalUnlinkedCount = useMemo(() => countBlocks(unlinkedReferences), [unlinkedReferences]);

  const filteredLinkedReferences = useMemo(
    () => filterGroupsByQuery(linkedReferences, filterQuery),
    [linkedReferences, filterQuery]
  );

  const filteredUnlinkedReferences = useMemo(
    () => filterGroupsByQuery(unlinkedReferences, filterQuery),
    [unlinkedReferences, filterQuery]
  );

  const toggleBlock = useCallback((blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId],
    }));
  }, []);

  const handleContainerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsLinkedExpanded(false);
      setIsUnlinkedExpanded(false);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsLinkedExpanded(true);
      setIsUnlinkedExpanded(true);
    }
  };

  const handleToggleFilter = () => {
    setIsFilterOpen(prev => !prev);
  };

  React.useEffect(() => {
    if (isFilterOpen) {
      const timer = window.setTimeout(() => {
        filterInputRef.current?.focus();
      }, 80);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isFilterOpen]);

  const renderBreadcrumbs = (
    breadcrumbs: ReferenceGroup['blocks'][number]['breadcrumbs']
  ) => {
    if (breadcrumbs.length === 0) {
      return null;
    }

    return (
      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-muted)]">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.blockId}>
            <span className="rounded bg-[var(--color-tag-bg)] px-1.5 py-0.5">
              {crumb.content || '（空白内容）'}
            </span>
            {index < breadcrumbs.length - 1 && (
              <span className="text-[var(--color-border-subtle)]">/</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderGroups = (
    groups: ReferenceGroup[],
    options: {
      highlightPlainMentions?: boolean;
    }
  ) => {
    if (groups.length === 0) {
      return (
        <p className="text-sm text-[var(--color-text-muted)]">暂无内容</p>
      );
    }

    return groups.map(group => (
      <div key={group.pageId} className="space-y-3">
        <button
          type="button"
          onClick={() => onNavigateToPage?.(group.pageId)}
          className="text-sm font-semibold text-[var(--color-link-text)] hover:underline"
        >
          {group.pageTitle}
        </button>
        {group.blocks.map(block => {
          const isExpanded = expandedBlocks[block.blockId] ?? true;
          const preview = summarizeContent(block.blockContent);
          return (
            <div
              key={block.blockId}
              className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-editor-bg)] p-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleBlock(block.blockId)}
                  className="mt-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                  aria-label={isExpanded ? '折叠引用' : '展开引用'}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => onNavigateToPage?.(group.pageId)}
                    className="text-sm font-medium text-[var(--color-link-text)] hover:underline"
                  >
                    {group.pageTitle}
                  </button>
                  {isExpanded ? (
                    <div className="mt-2 text-sm text-[var(--color-text-primary)]">
                      {renderBreadcrumbs(block.breadcrumbs)}
                      <div className="whitespace-pre-wrap break-words">
                        {renderLinkedText(block.blockContent, `reference-${block.blockId}`, {
                          highlightTitle: pageTitle,
                          highlightPlainMentions: options.highlightPlainMentions,
                          onLinkClick,
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {preview}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <div
      className="space-y-6 focus:outline-none"
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
    >
      <section>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]"
            onClick={() => setIsLinkedExpanded(prev => !prev)}
            aria-expanded={isLinkedExpanded}
          >
            {isLinkedExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span>Linked References</span>
            <span className="text-[var(--color-text-muted)]">· {filterQuery.trim() ? countBlocks(filteredLinkedReferences) : totalLinkedCount}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleFilter}
            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] ${
              isFilterOpen ? 'bg-[var(--color-border-subtle)]' : ''
            }`}
            aria-pressed={isFilterOpen}
            aria-label="筛选链接引用"
          >
            <Filter size={16} />
          </button>
        </div>
        {isFilterOpen && (
          <div className="mt-3">
            <input
              ref={filterInputRef}
              type="text"
              value={filterQuery}
              onChange={event => setFilterQuery(event.target.value)}
              className="w-full rounded border border-[var(--color-border-subtle)] bg-[var(--color-editor-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              placeholder="按页面、标签或内容过滤引用"
            />
          </div>
        )}
        {isLinkedExpanded && (
          <div className="mt-4 space-y-4">
            {renderGroups(filteredLinkedReferences, { highlightPlainMentions: false })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          <button
            type="button"
            className="flex items-center gap-2"
            onClick={() => setIsUnlinkedExpanded(prev => !prev)}
            aria-expanded={isUnlinkedExpanded}
          >
            {isUnlinkedExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span>Unlinked References</span>
            <span className="text-[var(--color-text-muted)]">· {filterQuery.trim() ? countBlocks(filteredUnlinkedReferences) : totalUnlinkedCount}</span>
          </button>
        </div>
        {isUnlinkedExpanded && (
          <div className="mt-4 space-y-4">
            {renderGroups(filteredUnlinkedReferences, { highlightPlainMentions: true })}
          </div>
        )}
      </section>
    </div>
  );
};
