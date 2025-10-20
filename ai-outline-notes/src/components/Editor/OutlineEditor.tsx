// 大纲编辑器主组件
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { BlockEditor } from './BlockEditor';
import { 
  createBlock, 
  updateBlock, 
  deleteBlock, 
  indentBlock, 
  outdentBlock,
  getPageBlocks,
  toggleBlockCollapse,
  ensureLinksForContent
} from '../../utils/blockUtils';
import { ensurePageByTitle, extractPageLinks, getBacklinks } from '../../utils/pageUtils';
import type { Block } from '../../types';

interface OutlineEditorProps {
  pageId: string;
  onBlockSelect?: (blockId: string | null, content: string) => void;
  onNavigateToPage?: (pageId: string) => void;
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({ 
  pageId,
  onBlockSelect,
  onNavigateToPage
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isCreatingFirstBlock, setIsCreatingFirstBlock] = useState(false);
  const initializedPagesRef = useRef<Set<string>>(new Set());
  const pendingFocusRef = useRef<{ blockId: string; caret?: number } | null>(null);

  const focusBlockTextarea = useCallback((blockId: string, caretPosition?: number) => {
    let attempts = 0;
    const scheduleFocus = () => {
      if (attempts > 30) {
        return;
      }
      attempts += 1;
      requestAnimationFrame(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          `[data-block-textarea="${blockId}"]`
        );
        if (textarea) {
          textarea.focus();
          const caret = typeof caretPosition === 'number'
            ? Math.max(0, Math.min(caretPosition, textarea.value.length))
            : textarea.value.length;
          textarea.setSelectionRange(caret, caret);
        } else {
          scheduleFocus();
        }
      });
    };

    scheduleFocus();
  }, []);

  useEffect(() => {
    pendingFocusRef.current = null;
    setIsCreatingFirstBlock(false);
    setSelectedBlockId(null);
    if (onBlockSelect) {
      onBlockSelect(null, '');
    }
    setBlocks([]);
  }, [pageId, onBlockSelect]);

  // 实时查询页面的所有块
  const liveBlocks = useLiveQuery(
    () => getPageBlocks(pageId),
    [pageId]
  );

  const page = useLiveQuery(
    () => db.pages.get(pageId),
    [pageId]
  );

  const pageTitle = page?.title ?? '';

  useEffect(() => {
    if (liveBlocks) {
      setBlocks(liveBlocks);
    }
  }, [liveBlocks]);

  useEffect(() => {
    if (!liveBlocks) {
      return;
    }

    // 如果有块，检查是否属于当前页面
    if (liveBlocks.length > 0) {
      // 确保这些块是当前页面的
      if (liveBlocks[0].pageId === pageId) {
        initializedPagesRef.current.add(pageId);
      }
      return;
    }

    // 如果已经初始化过或正在创建中，跳过
    if (initializedPagesRef.current.has(pageId) || isCreatingFirstBlock) {
      return;
    }

    // 标记页面已初始化和正在创建中
    initializedPagesRef.current.add(pageId);
    setIsCreatingFirstBlock(true);
    
    let isActive = true;
    void (async () => {
      try {
        const newBlock = await createBlock(pageId, '');
        if (!isActive) {
          return;
        }
        pendingFocusRef.current = { blockId: newBlock.id, caret: 0 };
        setSelectedBlockId(newBlock.id);
        if (onBlockSelect) {
          onBlockSelect(newBlock.id, '');
        }
        // 延迟聚焦以确保 DOM 已更新
        setTimeout(() => {
          focusBlockTextarea(newBlock.id, 0);
        }, 100);
      } catch (error) {
        console.error('创建首个块时出错:', error);
      } finally {
        if (isActive) {
          setIsCreatingFirstBlock(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [liveBlocks, pageId, onBlockSelect, focusBlockTextarea]);

  useEffect(() => {
    if (blocks.length === 0) {
      return;
    }

    if (selectedBlockId && blocks.some(block => block.id === selectedBlockId)) {
      return;
    }

    const firstBlock = blocks[0];
    setSelectedBlockId(firstBlock.id);
    if (onBlockSelect) {
      onBlockSelect(firstBlock.id, firstBlock.content);
    }
    pendingFocusRef.current = { blockId: firstBlock.id };
    focusBlockTextarea(firstBlock.id);
  }, [blocks, selectedBlockId, onBlockSelect, focusBlockTextarea]);

  useEffect(() => {
    if (!selectedBlockId) {
      return;
    }

    const pending = pendingFocusRef.current;
    const targetCaret =
      pending && pending.blockId === selectedBlockId ? pending.caret : undefined;

    const existsInState = blocks.some(block => block.id === selectedBlockId);

    if (!existsInState) {
      if (!pending || pending.blockId !== selectedBlockId) {
        pendingFocusRef.current = { blockId: selectedBlockId, caret: targetCaret };
      }
      return;
    }

    focusBlockTextarea(selectedBlockId, targetCaret);

    if (pending && pending.blockId === selectedBlockId) {
      pendingFocusRef.current = null;
    }
  }, [selectedBlockId, blocks, focusBlockTextarea]);

  const outgoingLinks = useMemo(() => {
    const links = new Set<string>();

    for (const block of blocks) {
      const linkTitles = extractPageLinks(block.content);
      for (const title of linkTitles) {
        const normalized = title.trim();
        if (!normalized) continue;
        links.add(normalized);
      }
    }

    return Array.from(links).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [blocks]);

  const backlinks =
    useLiveQuery(
      () => (pageTitle ? getBacklinks(pageTitle) : []),
      [pageTitle]
    ) ?? [];

  // 计算块的层级（通过递归查找父块）
  const getBlockLevel = (block: Block): number => {
    let level = 0;
    let currentBlock = block;
    
    while (currentBlock.parentId) {
      level++;
      const parent = blocks.find(b => b.id === currentBlock.parentId);
      if (!parent) break;
      currentBlock = parent;
    }
    
    return level;
  };

  // 构建树形结构（展平显示，但保持层级关系，考虑折叠状态）
  const buildFlatTree = (blocks: Block[]): Block[] => {
    const result: Block[] = [];
    
    const addBlockWithChildren = (block: Block) => {
      result.push(block);
      
      // 如果块被折叠，不添加子块
      if (block.collapsed) {
        return;
      }
      
      // 找到所有子块并排序
      const children = blocks
        .filter(b => b.parentId === block.id)
        .sort((a, b) => a.order - b.order);
      
      children.forEach(addBlockWithChildren);
    };
    
    // 添加所有顶层块
    const topLevelBlocks = blocks
      .filter(b => !b.parentId)
      .sort((a, b) => a.order - b.order);
    
    topLevelBlocks.forEach(addBlockWithChildren);
    
    return result;
  };

  const flatTree = buildFlatTree(blocks);

  const handleUpdate = async (id: string, content: string) => {
    await updateBlock(id, content);
    
    // 通知父组件（用于 AI 面板）
    if (selectedBlockId === id && onBlockSelect) {
      onBlockSelect(id, content);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBlock(id);
    setSelectedBlockId(null);
  };

  const handleIndent = async (id: string) => {
    await indentBlock(id);
  };

  const handleOutdent = async (id: string) => {
    await outdentBlock(id);
  };

  const handleSelect = (id: string) => {
    setSelectedBlockId(id);
    const block = blocks.find(b => b.id === id);
    if (block && onBlockSelect) {
      onBlockSelect(id, block.content);
    }
    pendingFocusRef.current = { blockId: id };
    focusBlockTextarea(id);
  };

  const handleDeselect = (id: string) => {
    setSelectedBlockId(prevId => {
      if (prevId === id) {
        if (onBlockSelect) {
          onBlockSelect(null, '');
        }
        return null;
      }
      return prevId;
    });

    const block = blocks.find(b => b.id === id);
    if (block) {
      void ensureLinksForContent(block.content);
    }
  };

  const handleCreateBelow = async (afterBlockId: string) => {
    const afterBlock = blocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;
    
    const newBlock = await createBlock(
      pageId,
      '',
      afterBlock.parentId,
      afterBlock.order + 1
    );
    
    // 更新后续块的 order
    const siblings = blocks.filter(
      b => b.parentId === afterBlock.parentId && b.order > afterBlock.order
    );
    for (const sibling of siblings) {
      await db.blocks.update(sibling.id, { order: sibling.order + 1 });
    }
    
    // 选中新块
    setSelectedBlockId(newBlock.id);
    pendingFocusRef.current = { blockId: newBlock.id, caret: 0 };
    if (onBlockSelect) {
      onBlockSelect(newBlock.id, '');
    }
    focusBlockTextarea(newBlock.id, 0);
  };

  const handleFocusPrevious = (currentId: string) => {
    const currentIndex = flatTree.findIndex(b => b.id === currentId);
    if (currentIndex > 0) {
      const targetId = flatTree[currentIndex - 1].id;
      setSelectedBlockId(targetId);
      pendingFocusRef.current = { blockId: targetId };
      focusBlockTextarea(targetId);
    }
  };

  const handleFocusNext = (currentId: string) => {
    const currentIndex = flatTree.findIndex(b => b.id === currentId);
    if (currentIndex < flatTree.length - 1) {
      const targetId = flatTree[currentIndex + 1].id;
      setSelectedBlockId(targetId);
      pendingFocusRef.current = { blockId: targetId };
      focusBlockTextarea(targetId);
    }
  };

  const handleToggleCollapse = async (blockId: string) => {
    await toggleBlockCollapse(blockId);
  };

  // 检查块是否有子块
  const hasChildren = (blockId: string): boolean => {
    return blocks.some(b => b.parentId === blockId);
  };

  const handleLinkClick = async (title: string) => {
    const page = await ensurePageByTitle(title, 'note', { isReference: true });
    if (page && onNavigateToPage) {
      onNavigateToPage(page.id);
    }
  };

  const renderLinkedText = (
    content: string,
    keyPrefix: string,
    highlightTitle?: string
  ): React.ReactNode => {
    const regex = /\[\[([^\]]+)\]\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let segmentIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      const before = content.slice(lastIndex, matchIndex);
      if (before.length > 0) {
        elements.push(
          <span
            key={`${keyPrefix}-text-${segmentIndex}`}
            className="whitespace-pre-wrap break-words"
          >
            {before}
          </span>
        );
        segmentIndex++;
      }

      const rawTitle = match[1];
      const normalizedTitle = rawTitle.trim();
      const isHighlight =
        Boolean(highlightTitle) && normalizedTitle === highlightTitle;

      elements.push(
        <button
          type="button"
          key={`${keyPrefix}-link-${segmentIndex}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (normalizedTitle.length > 0) {
              void handleLinkClick(normalizedTitle);
            }
          }}
          className={`inline-flex items-center rounded px-1.5 py-0.5 transition-colors duration-200 border border-transparent ${
            isHighlight
              ? 'bg-[var(--color-link-hover-bg)] text-[var(--color-link-text)] font-semibold'
              : 'bg-[var(--color-link-bg)] text-[var(--color-link-text)] hover:bg-[var(--color-link-hover-bg)]'
          }`}
          title={`跳转到页面：${normalizedTitle || rawTitle || ''}`}
        >
          {`[[${normalizedTitle || rawTitle || ''}]]`}
        </button>
      );
      segmentIndex++;

      lastIndex = regex.lastIndex;
    }

    const after = content.slice(lastIndex);
    if (after.length > 0) {
      elements.push(
        <span
          key={`${keyPrefix}-text-${segmentIndex}-end`}
          className="whitespace-pre-wrap break-words"
        >
          {after}
        </span>
      );
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

  return (
    <div className="outline-editor h-full overflow-y-auto p-4 bg-[var(--color-editor-bg)] transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        {flatTree.map(block => (
          <BlockEditor
            key={block.id}
            block={block}
            level={getBlockLevel(block)}
            isSelected={selectedBlockId === block.id}
            hasChildren={hasChildren(block.id)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            onCreateBelow={handleCreateBelow}
            onFocusPrevious={handleFocusPrevious}
            onFocusNext={handleFocusNext}
            onToggleCollapse={handleToggleCollapse}
            onLinkClick={handleLinkClick}
          />
        ))}

        <div className="mt-10 border-t border-[var(--color-border-subtle)] pt-6 space-y-8">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
              页面链接
            </h3>
            {outgoingLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {outgoingLinks.map(title => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => void handleLinkClick(title)}
                    className="inline-flex items-center rounded px-2 py-1 bg-[var(--color-link-bg)] text-[var(--color-link-text)] hover:bg-[var(--color-link-hover-bg)] transition-colors duration-200 border border-transparent text-sm"
                    title={`跳转到页面：${title}`}
                  >
                    {`[[${title}]]`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">暂无页面链接</p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
              反向链接
            </h3>
            {backlinks.length > 0 ? (
              <div className="space-y-4">
                {backlinks.map(backlink => (
                  <div
                    key={backlink.blockId}
                    className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-editor-bg)] p-3 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigateToPage?.(backlink.pageId)}
                      className="text-sm font-medium text-[var(--color-link-text)] hover:underline"
                    >
                      {backlink.pageTitle}
                    </button>
                    <div className="mt-2 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                      {renderLinkedText(backlink.blockContent, `backlink-${backlink.blockId}`, pageTitle)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">暂无反向链接</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
