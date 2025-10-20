// 单个块编辑器组件
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { Block } from '../../types';

interface ParsedMarkdownImage {
  alt: string;
  url: string;
}

const LIST_PREFIX_PATTERN = /^(?:[-*+]\s+|\d+\.\s+)/;

const parseMarkdownImage = (value: string): ParsedMarkdownImage | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('![') && !trimmed.match(LIST_PREFIX_PATTERN)) {
    return null;
  }

  const withoutListPrefix = trimmed.replace(LIST_PREFIX_PATTERN, '');
  if (!withoutListPrefix.startsWith('![')) {
    return null;
  }

  const altCloseIndex = withoutListPrefix.indexOf('](');
  if (altCloseIndex === -1) {
    return null;
  }

  const altText = withoutListPrefix.slice(2, altCloseIndex).trim();
  const remainder = withoutListPrefix.slice(altCloseIndex + 2);
  const closingParenIndex = remainder.lastIndexOf(')');
  if (closingParenIndex === -1) {
    return null;
  }

  const target = remainder.slice(0, closingParenIndex).trim();
  const trailing = remainder.slice(closingParenIndex + 1).trim();
  if (!target) {
    return null;
  }

  if (trailing.length > 0 && !/^\{:[^}]+\}$/.test(trailing)) {
    return null;
  }

  let url = target;
  const titleMatch = target.match(/\s+["'](.+)["']$/);
  if (titleMatch) {
    url = target.slice(0, target.length - titleMatch[0].length).trim();
  }

  if (!url) {
    return null;
  }

  return {
    alt: altText || 'image',
    url,
  };
};

const findWikiLinkAtPosition = (text: string, position: number) => {
  const openIndex = text.lastIndexOf('[[', position);
  if (openIndex === -1) {
    return null;
  }

  const closeIndex = text.indexOf(']]', position);
  if (closeIndex === -1) {
    return null;
  }

  if (position <= openIndex + 1 || position > closeIndex) {
    return null;
  }

  const title = text.slice(openIndex + 2, closeIndex);
  return {
    title,
    start: openIndex,
    end: closeIndex + 2,
  };
};

interface BlockEditorProps {
  block: Block;
  level: number; // 缩进层级
  isSelected: boolean;
  hasChildren: boolean; // 是否有子块
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onSelect: (id: string) => void;
  onDeselect: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onFocusPrevious: (id: string) => void;
  onFocusNext: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onLinkClick?: (title: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  level,
  isSelected,
  hasChildren,
  onUpdate,
  onDelete,
  onIndent,
  onOutdent,
  onSelect,
  onDeselect,
  onCreateBelow,
  onFocusPrevious,
  onFocusNext,
  onToggleCollapse,
  onLinkClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayContentRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const lastSelectionRef = useRef<number | null>(null);
  const [content, setContent] = useState(block.content);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setContent(block.content);
  }, [block.content]);

  useLayoutEffect(() => {
    if (!isSelected || !textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    textarea.focus();

    const pending = pendingCursorRef.current;
    pendingCursorRef.current = null;

    const fallback = lastSelectionRef.current;
    const cursorPosition =
      typeof pending === 'number'
        ? pending
        : typeof fallback === 'number'
          ? fallback
          : textarea.value.length;

    const clamped = Math.max(0, Math.min(cursorPosition, textarea.value.length));
    textarea.setSelectionRange(clamped, clamped);
  }, [isSelected]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab: 缩进
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent(block.id);
      } else {
        onIndent(block.id);
      }
      return;
    }

    // Enter: 在下方创建新块
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onCreateBelow(block.id);
      return;
    }

    // Backspace: 如果内容为空，删除当前块
    if (e.key === 'Backspace' && content === '') {
      e.preventDefault();
      onDelete(block.id);
      onFocusPrevious(block.id);
      return;
    }

    // ArrowUp: 跳到上一个块
    if (e.key === 'ArrowUp' && textareaRef.current?.selectionStart === 0) {
      e.preventDefault();
      onFocusPrevious(block.id);
      return;
    }

    // ArrowDown: 跳到下一个块
    if (e.key === 'ArrowDown') {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === content.length) {
        e.preventDefault();
        onFocusNext(block.id);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onUpdate(block.id, newContent);
  };

  const handleFocus = () => {
    onSelect(block.id);
  };
  const handleBlur = () => {
    if (textareaRef.current) {
      lastSelectionRef.current = textareaRef.current.selectionStart;
    } else {
      lastSelectionRef.current = null;
    }
    onDeselect(block.id);
  };

  const parsedImage = parseMarkdownImage(content);
  const showImagePreview = Boolean(parsedImage && !isSelected);

  const setMarkdownImage = (file: File, dataUrl: string) => {
    const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
    const safeAlt = (baseName || 'image').replace(/([\[\]\\])/g, '\\$1');
    const markdown = `![${safeAlt}](${dataUrl})`;
    setContent(markdown);
    onUpdate(block.id, markdown);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items = Array.from(e.dataTransfer.items || []);
    const candidateFromItems = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file && file.type.startsWith('image/')));

    const files = candidateFromItems.length > 0
      ? candidateFromItems
      : Array.from(e.dataTransfer.files || []).filter(file =>
          file.type.startsWith('image/')
        );

    if (files.length === 0) {
      return;
    }

    const [firstImage] = files;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setMarkdownImage(firstImage, result);
      }
    };
    reader.readAsDataURL(firstImage);
    onSelect(block.id);
  };

  const handleMenuToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(prev => !prev);
  };

  const handleDeleteConfirm = () => {
    setIsMenuOpen(false);
    onDelete(block.id);
    onFocusPrevious(block.id);
  };
 
  const navigateToLinkAtCaret = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    if (textarea.selectionStart !== textarea.selectionEnd) {
      return;
    }

    const caretPosition = textarea.selectionStart;
    const link = findWikiLinkAtPosition(textarea.value, caretPosition);
    if (!link) {
      return;
    }

    const normalizedTitle = link.title.trim();
    if (!normalizedTitle) {
      return;
    }

    textarea.blur();
    onLinkClick?.(normalizedTitle);
  };

  const handleTextareaMouseUp = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (event.button !== 0) {
      return;
    }

    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();

    setTimeout(() => {
      navigateToLinkAtCaret();
    }, 0);
  };

  const handleTextareaTouchEnd = (event: React.TouchEvent<HTMLTextAreaElement>) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    setTimeout(() => {
      navigateToLinkAtCaret();
    }, 0);
  };

  const updatePendingCursorFromPoint = (clientX: number, clientY: number) => {
    const container = displayContentRef.current;
    if (!container) {
      pendingCursorRef.current = null;
      return;
    }

    const doc = container.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };

    let range: Range | null = null;

    if (typeof doc.caretRangeFromPoint === 'function') {
      range = doc.caretRangeFromPoint(clientX, clientY);
    }

    if (!range && typeof doc.caretPositionFromPoint === 'function') {
      const position = doc.caretPositionFromPoint(clientX, clientY);
      if (position) {
        range = doc.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }

    if (!range) {
      pendingCursorRef.current = block.content.length;
      return;
    }

    const startContainer = range.startContainer;
    if (!container.contains(startContainer) && startContainer !== container) {
      pendingCursorRef.current = block.content.length;
      return;
    }

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);

    const offset = preSelectionRange.toString().length;
    pendingCursorRef.current = Math.max(0, Math.min(offset, block.content.length));
  };

  const handleDisplayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-wiki-link="true"]')) {
      pendingCursorRef.current = null;
      return;
    }

    updatePendingCursorFromPoint(event.clientX, event.clientY);
  };

  const handleDisplayTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-wiki-link="true"]')) {
      pendingCursorRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    updatePendingCursorFromPoint(touch.clientX, touch.clientY);
  };

  const renderDisplayContent = (): React.ReactNode => {
    const trimmed = block.content.trim();
    if (trimmed.length === 0) {
      return (
        <span className="text-[var(--color-text-muted)] italic">
          点击开始输入...
        </span>
      );
    }

    const regex = /\[\[([^\]]+)\]\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(block.content)) !== null) {
      const matchIndex = match.index;
      const before = block.content.slice(lastIndex, matchIndex);
      if (before.length > 0) {
        elements.push(
          <span key={`text-${block.id}-${lastIndex}`} className="whitespace-pre-wrap break-words">
            {before}
          </span>
        );
      }

      const rawTitle = match[1];
      const normalizedTitle = rawTitle.trim();
      const labelTitle = normalizedTitle || rawTitle || '未命名页面';
      elements.push(
        <button
          type="button"
          key={`link-${block.id}-${matchIndex}`}
          data-wiki-link="true"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (normalizedTitle.length > 0) {
              onLinkClick?.(normalizedTitle);
            }
          }}
          className="inline-flex items-center rounded px-1.5 py-0.5 bg-[var(--color-link-bg)] text-[var(--color-link-text)] hover:bg-[var(--color-link-hover-bg)] transition-colors duration-200 border border-transparent"
          title={`跳转到页面：${labelTitle}`}
        >
          {`[[${normalizedTitle || rawTitle || ''}]]`}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    const after = block.content.slice(lastIndex);
    if (after.length > 0) {
      elements.push(
        <span key={`text-${block.id}-${lastIndex}-end`} className="whitespace-pre-wrap break-words">
          {after}
        </span>
      );
    }

    return elements;
  };

  return (
    <div
      ref={containerRef}
      className="block-item flex items-start group min-h-[24px]"
      style={{
        paddingLeft: `${level * 24}px`,
        paddingTop: '2px',
        paddingBottom: '2px'
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragEnterCapture={handleDragEnter}
      onDragOverCapture={handleDragOver}
      onDrop={handleDrop}
      onDropCapture={handleDrop}
    >
      {/* Logseq 风格的小圆点 - 合并按钮 */}
      <div className="relative flex-shrink-0 mr-2 pt-[7px]">
        {hasChildren ? (
          <div className="flex items-center">
            <button
              onClick={() => onToggleCollapse(block.id)}
              onContextMenu={handleMenuToggle}
              className="w-[18px] h-[18px] flex items-center justify-center hover:bg-gray-200/50 rounded transition-colors duration-150"
              title={block.collapsed ? '展开 | 右键更多操作' : '折叠 | 右键更多操作'}
            >
              {block.collapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
            {isMenuOpen && (
              <div className="absolute left-6 top-0 z-20 w-48 rounded-md border border-[var(--color-popover-border)] bg-[var(--color-popover-bg)] py-2 shadow-lg transition-colors duration-200">
                <div className="px-3 pb-1 text-xs font-medium text-[var(--color-text-secondary)]">块操作</div>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-colors duration-200 rounded-md"
                >
                  <span>删除选定块</span>
                  <span className="text-xs text-[var(--color-text-muted)]">Delete</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onContextMenu={handleMenuToggle}
            className="w-[18px] h-[18px] flex items-center justify-center hover:bg-gray-200/50 rounded transition-colors duration-150 relative"
            title="右键更多操作"
          >
            <div
              className="rounded-full"
              style={{
                width: '6px',
                height: '6px',
                backgroundColor: 'rgb(199, 199, 199)',
                opacity: 0.8
              }}
            />
            {isMenuOpen && (
              <div className="absolute left-6 top-0 z-20 w-48 rounded-md border border-[var(--color-popover-border)] bg-[var(--color-popover-bg)] py-2 shadow-lg transition-colors duration-200">
                <div className="px-3 pb-1 text-xs font-medium text-[var(--color-text-secondary)]">块操作</div>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-colors duration-200 rounded-md"
                >
                  <span>删除选定块</span>
                  <span className="text-xs text-[var(--color-text-muted)]">Delete</span>
                </button>
              </div>
            )}
          </button>
        )}
      </div>

      {/* 块内容编辑器 */}
      <div className="flex-1">
        {showImagePreview ? (
          <button
            type="button"
            onClick={() => onSelect(block.id)}
            className="w-full cursor-pointer rounded-sm py-0.5 px-1 transition-colors hover:bg-gray-50 focus:outline-none"
            title="点击查看图片地址"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragEnterCapture={handleDragEnter}
            onDragOverCapture={handleDragOver}
            onDrop={handleDrop}
            onDropCapture={handleDrop}
          >
            <img
              src={parsedImage?.url}
              alt={parsedImage?.alt}
              className="max-h-80 max-w-full rounded border border-[var(--color-border-subtle)] object-contain"
            />
          </button>
        ) : isSelected ? (
          <textarea
            ref={textareaRef}
            data-block-textarea={block.id}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onMouseUp={handleTextareaMouseUp}
            onTouchEnd={handleTextareaTouchEnd}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragEnterCapture={handleDragEnter}
            onDragOverCapture={handleDragOver}
            onDrop={handleDrop}
            onDropCapture={handleDrop}
            autoFocus={isSelected}
            className="w-full resize-none border-none outline-none bg-transparent py-0.5 px-1 rounded-sm
                       focus:ring-0 focus:outline-none
                       text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] selection:bg-blue-200/50"
            rows={1}
            style={{ lineHeight: '1.5' }}
          />
        ) : (
          <div
            ref={displayContentRef}
            tabIndex={0}
            role="button"
            onClick={() => onSelect(block.id)}
            onFocus={(event) => {
              if (event.target === event.currentTarget) {
                onSelect(block.id);
              }
            }}
            onMouseDown={handleDisplayMouseDown}
            onTouchStart={handleDisplayTouchStart}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSelect(block.id);
              }
            }}
            className="w-full cursor-text py-0.5 px-1 rounded-sm outline-none focus:ring-0 text-[var(--color-text-primary)] whitespace-pre-wrap break-words"
            style={{ lineHeight: '1.5' }}
          >
            {renderDisplayContent()}
          </div>
        )}
      </div>
    </div>
  );
};
