// 单个块编辑器组件
import React, { useRef, useEffect, useState } from 'react';
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(block.content);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setContent(block.content);
  }, [block.content]);

  useEffect(() => {
    if (isSelected && textareaRef.current) {
      textareaRef.current.focus();
    }
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

  return (
    <div
      ref={containerRef}
      className={`block-item flex items-start group rounded-md transition-colors duration-200 hover:bg-[var(--color-block-hover-bg)] ${isSelected ? 'bg-[var(--color-block-selected-bg)]' : ''}`}
      style={{ paddingLeft: `${level * 24}px` }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragEnterCapture={handleDragEnter}
      onDragOverCapture={handleDragOver}
      onDrop={handleDrop}
      onDropCapture={handleDrop}
    >
      {/* 折叠/展开按钮 */}
      <div className="flex-shrink-0 mr-1 pt-2">
        {hasChildren ? (
          <button
            onClick={() => onToggleCollapse(block.id)}
            className="w-5 h-5 flex items-center justify-center hover:bg-[var(--color-block-hover-bg)] rounded transition-colors duration-200"
            title={block.collapsed ? '展开' : '折叠'}
          >
            {block.collapsed ? (
              <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5" /> // 占位，保持对齐
        )}
      </div>

      {/* 块拖拽手柄 */}
      <div className="relative flex-shrink-0 mr-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onContextMenu={handleMenuToggle}
          className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
          title="更多操作"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="4" cy="4" r="1.5"/>
            <circle cx="12" cy="4" r="1.5"/>
            <circle cx="4" cy="8" r="1.5"/>
            <circle cx="12" cy="8" r="1.5"/>
            <circle cx="4" cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
          </svg>
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

      {/* 块内容编辑器 */}
      <div className="flex-1">
        {showImagePreview ? (
          <button
            type="button"
            onClick={() => onSelect(block.id)}
            className="w-full cursor-pointer rounded py-2 px-2 transition-colors hover:bg-[var(--color-block-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
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
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragEnterCapture={handleDragEnter}
            onDragOverCapture={handleDragOver}
            onDrop={handleDrop}
            onDropCapture={handleDrop}
            className="w-full resize-none border-none outline-none bg-transparent py-2 px-2 rounded
                       focus:ring-2 focus:ring-[var(--color-accent)] focus:bg-[var(--color-editor-bg)]
                       text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] selection:bg-[var(--color-accent-soft)]"
            rows={1}
          />
        )}
      </div>
    </div>
  );
};
