// 单个块编辑器组件
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Block } from '../../types';
import { useResolvedImageUrl } from '../../hooks/useResolvedImageUrl';

interface ParsedMarkdownImage {
  alt: string;
  url: string;
}

type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> &
  ExtraProps & {
    inline?: boolean;
    children?: React.ReactNode;
  };

const LIST_PREFIX_PATTERN = /^(?:[-*+]\s+|\d+\.\s+)/;
const TEXTAREA_DRAG_THRESHOLD_PX = 6;

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
  pageDirectory: 'pages' | 'journals';
  level: number; // 缩进层级
  isSelected: boolean;
  isEditing: boolean;
  selectionCount: number;
  hasChildren: boolean; // 是否有子块
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDeleteSelection: () => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onSelect: (
    id: string,
    action?: { mode?: 'replace' | 'range' | 'toggle'; edit?: boolean; caret?: number }
  ) => void;
  onDeselect: (id: string) => void;
  onCreateBelow: (id: string) => void;
  onFocusPrevious: (id: string) => void;
  onFocusNext: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onLinkClick?: (title: string) => void;
  onMouseSelectionStart?: (id: string, event?: React.MouseEvent) => void;
  onMouseSelectionEnter?: (id: string) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  pageDirectory,
  level,
  isSelected,
  isEditing,
  selectionCount,
  hasChildren,
  onUpdate,
  onDelete,
  onDeleteSelection,
  onIndent,
  onOutdent,
  onSelect,
  onDeselect,
  onCreateBelow,
  onFocusPrevious,
  onFocusNext,
  onToggleCollapse,
  onLinkClick,
  onMouseSelectionStart,
  onMouseSelectionEnter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayContentRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const lastSelectionRef = useRef<number | null>(null);
  const mouseDownPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isTextareaMouseDownRef = useRef(false);
  const hasStartedSelectionFromTextareaRef = useRef(false);
  const [content, setContent] = useState(block.content);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHoveringBullet, setIsHoveringBullet] = useState(false);
  const markdownComponents = useMemo<Components>(
    () => ({
      p: ({ children }) => (
        <p className="m-0 whitespace-pre-wrap break-words leading-[1.5] text-[var(--color-text-primary)]">
          {children}
        </p>
      ),
      code({ inline, className, children, ...props }: MarkdownCodeProps) {
        const childContent = Array.isArray(children) ? children.join('') : children ?? '';
        const codeContent = String(childContent).replace(/\n$/, '');
        const languageMatch = /language-([\w-]+)/.exec(className ?? '');
        const language = languageMatch?.[1] ?? '';
        const languageLabel = language ? language.toUpperCase() : 'PLAIN TEXT';

        if (!inline) {
          return (
            <div className="my-2 w-full overflow-hidden rounded-md border border-[var(--color-code-border, var(--color-border-subtle))] bg-[var(--color-code-block-bg, #0f172a)]">
              <div className="border-b border-[var(--color-code-border, var(--color-border-subtle))] bg-[var(--color-code-block-header-bg, rgba(15,23,42,0.85))] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                {languageLabel}
              </div>
              <SyntaxHighlighter
                PreTag="div"
                language={language || undefined}
                style={oneDark}
                customStyle={{
                  margin: 0,
                  background: 'transparent',
                  padding: '12px 16px',
                }}
                codeTagProps={{
                  style: {
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '13px',
                  },
                }}
              >
                {codeContent}
              </SyntaxHighlighter>
            </div>
          );
        }

        return (
          <code
            className="rounded bg-[var(--color-code-inline-bg, rgba(15,23,42,0.08))] px-1 py-0.5 text-sm font-mono text-[var(--color-code-inline-text, #0f172a)]"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children }) => <>{children}</>,
      ul: ({ children }) => (
        <ul className="my-1 list-disc pl-5 text-[var(--color-text-primary)]">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="my-1 list-decimal pl-5 text-[var(--color-text-primary)]">{children}</ol>
      ),
      li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
    }),
    []
  );

  // 只在 block 改变且不是当前选中的块时，才同步外部内容
  useEffect(() => {
    if (!isEditing && block.content !== content) {
      setContent(block.content);
    }
  }, [block.content, isEditing, content]);

  useLayoutEffect(() => {
    if (!isEditing || !textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    textarea.focus();

    // 如果有待处理的光标位置，使用它
    const pending = pendingCursorRef.current;
    if (pending !== null) {
      pendingCursorRef.current = null;
      const clamped = Math.max(0, Math.min(pending, textarea.value.length));
      textarea.setSelectionRange(clamped, clamped);
      return;
    }

    // 否则使用上次保存的光标位置
    const fallback = lastSelectionRef.current;
    if (fallback !== null) {
      const clamped = Math.max(0, Math.min(fallback, textarea.value.length));
      textarea.setSelectionRange(clamped, clamped);
      return;
    }

    // 最后才是默认到末尾
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [isEditing]); // 只依赖 isEditing

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

  useEffect(() => {
    if (!isEditing) {
      isTextareaMouseDownRef.current = false;
      hasStartedSelectionFromTextareaRef.current = false;
    }
  }, [isEditing]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleWindowMouseUp = () => {
      isTextareaMouseDownRef.current = false;
      hasStartedSelectionFromTextareaRef.current = false;
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Delete/Backspace: 如果有多个块被选中，删除所有选中的块
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectionCount > 1 && isSelected) {
      e.preventDefault();
      onDeleteSelection();
      return;
    }

    // Escape: 退出编辑模式
    if (e.key === 'Escape') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.blur();
      }
      return;
    }

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
    const cursorPosition = e.target.selectionStart;

    // 保存当前光标位置
    lastSelectionRef.current = cursorPosition;

    // 立即更新本地状态
    setContent(newContent);

    // 异步更新数据库（不等待结果）
    onUpdate(block.id, newContent);
  };

  const handleCompositionStart = () => {
    // 中文输入法开始
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    // 中文输入法结束，确保更新内容
    const newContent = e.currentTarget.value;
    const cursorPosition = e.currentTarget.selectionStart;
    lastSelectionRef.current = cursorPosition;
    setContent(newContent);
    onUpdate(block.id, newContent);
  };

  const handleFocus = () => {
    onSelect(block.id, { mode: 'replace', edit: true });
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
  const resolvedImageUrl = useResolvedImageUrl(parsedImage?.url, pageDirectory);
  const displayImageUrl = resolvedImageUrl ?? parsedImage?.url;
  const showImagePreview = Boolean(parsedImage && !isEditing);

  const setMarkdownImage = (file: File, dataUrl: string) => {
    const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
    const safeAlt = (baseName || 'image').replace(/[[\]\\]/g, '\\$&');
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
    if (selectionCount > 1 && isSelected && !isEditing) {
      onDeleteSelection();
    } else {
      onDelete(block.id);
    }
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
    if (event.button === 0) {
      isTextareaMouseDownRef.current = false;
      hasStartedSelectionFromTextareaRef.current = false;
    }

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

  const startSelectionFromTextareaDrag = () => {
    if (hasStartedSelectionFromTextareaRef.current) {
      return;
    }
    hasStartedSelectionFromTextareaRef.current = true;
    onSelect(block.id, { mode: 'replace', edit: false });
    onMouseSelectionStart?.(block.id);
  };

  const handleDisplayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    // 记录鼠标按下的位置，用于检测是否发生了拖拽
    mouseDownPositionRef.current = { x: event.clientX, y: event.clientY };

    const target = event.target as HTMLElement | null;
    if (target && target.closest('[data-wiki-link="true"]')) {
      pendingCursorRef.current = null;
      return;
    }

    // 如果按住修饰键,不处理光标位置,让 onClick 处理选择逻辑
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      pendingCursorRef.current = null;
      return;
    }

    // 如果当前块已选中且正在编辑,更新光标位置但不开始鼠标选择
    if (isSelected && isEditing) {
      updatePendingCursorFromPoint(event.clientX, event.clientY);
      return;
    }

    // 对于未编辑的块（无论是否选中），都开始鼠标选择跟踪
    onMouseSelectionStart?.(block.id, event);

    // 准备进入编辑模式时的光标位置
    updatePendingCursorFromPoint(event.clientX, event.clientY);
  };

  const handleDisplayTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey) {
      pendingCursorRef.current = null;
      return;
    }

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

  const handleTextareaMouseDown = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (event.button !== 0) {
      return;
    }
    isTextareaMouseDownRef.current = true;
    hasStartedSelectionFromTextareaRef.current = false;
    mouseDownPositionRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleTextareaMouseMove = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (
      !isEditing ||
      !isTextareaMouseDownRef.current ||
      hasStartedSelectionFromTextareaRef.current ||
      (event.buttons & 1) === 0 ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const rect = textarea.getBoundingClientRect();
    const threshold = TEXTAREA_DRAG_THRESHOLD_PX;
    const isOutsideVertical =
      event.clientY < rect.top - threshold ||
      event.clientY > rect.bottom + threshold;
    const isOutsideHorizontal =
      event.clientX < rect.left - threshold ||
      event.clientX > rect.right + threshold;

    if (!isOutsideVertical && !isOutsideHorizontal) {
      return;
    }

    event.preventDefault();
    startSelectionFromTextareaDrag();
  };

  const handleTextareaMouseLeave = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (
      !isEditing ||
      !isTextareaMouseDownRef.current ||
      hasStartedSelectionFromTextareaRef.current ||
      (event.buttons & 1) === 0 ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }
    startSelectionFromTextareaDrag();
  };

  const renderDisplayContent = (source: string): React.ReactNode => {
    const trimmed = source.trim();
    if (trimmed.length === 0) {
      // 返回一个零宽字符以保持布局，但不显示任何文字
      return <span className="opacity-0">&nbsp;</span>;
    }

    const renderMarkdownSegment = (text: string, key: string) => {
      if (text.length === 0) {
        return null;
      }

      return (
        <ReactMarkdown
          key={key}
          skipHtml
          className="block-markdown"
          components={markdownComponents}
        >
          {text}
        </ReactMarkdown>
      );
    };

    const regex = /\[\[([^\]]+)\]\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
      const matchIndex = match.index;
      const before = source.slice(lastIndex, matchIndex);
      if (before.length > 0) {
        const markdownNode = renderMarkdownSegment(before, `text-${block.id}-${lastIndex}`);
        if (markdownNode) {
          elements.push(markdownNode);
        }
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

    const after = source.slice(lastIndex);
    if (after.length > 0) {
      const markdownNode = renderMarkdownSegment(after, `text-${block.id}-${lastIndex}-end`);
      if (markdownNode) {
        elements.push(markdownNode);
      }
    }

    return elements;
  };

  const containerClassName = [
    'block-item flex items-start group min-h-[24px] w-full rounded-md transition-colors duration-150 border border-transparent bg-transparent',
    isSelected
      ? selectionCount > 1
        ? 'border-blue-500/40 bg-blue-500/10 dark:border-blue-400/40 dark:bg-blue-500/15'
        : 'border-blue-400/50 bg-blue-400/10 dark:border-blue-300/40 dark:bg-blue-400/15'
      : ''
  ].join(' ').trim();

  return (
    <div
      ref={containerRef}
      data-block-container={block.id}
      className={containerClassName}
      style={{
        paddingLeft: `${level * 24}px`,
        paddingTop: '2px',
        paddingBottom: '2px'
      }}
      onMouseEnter={() => onMouseSelectionEnter?.(block.id)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragEnterCapture={handleDragEnter}
      onDragOverCapture={handleDragOver}
      onDrop={handleDrop}
      onDropCapture={handleDrop}
    >
      {/* Logseq 风格的折叠箭头 + 圆点 */}
      <div
        className="relative flex items-center flex-shrink-0 pt-[7px]"
        onMouseEnter={() => setIsHoveringBullet(true)}
        onMouseLeave={() => setIsHoveringBullet(false)}
        style={{ width: '32px', marginRight: '4px' }}
      >
        {/* 折叠/展开箭头 - 只在有子节点且hover时显示 - 使用绝对定位避免布局抖动 */}
        <div className="relative w-[32px] h-[18px] flex items-center">
          {hasChildren && isHoveringBullet && (
            <button
              onClick={() => onToggleCollapse(block.id)}
              className="absolute left-0 w-[14px] h-[18px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-all duration-150 arrow-fade-in"
              title={block.collapsed ? '展开' : '折叠'}
            >
              {block.collapsed ? (
                <ChevronRight className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400 transition-transform duration-150" />
              ) : (
                <ChevronDown className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400 transition-transform duration-150" />
              )}
            </button>
          )}

          {/* 圆点按钮 - 始终显示 - 使用绝对定位固定在右侧 */}
          <button
            onContextMenu={handleMenuToggle}
            onMouseDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              onMouseSelectionStart?.(block.id, event);
              event.preventDefault();
              if (event.shiftKey) {
                onSelect(block.id, { mode: 'range', edit: false });
              } else if (event.metaKey || event.ctrlKey) {
                onSelect(block.id, { mode: 'toggle', edit: false });
              } else {
                onSelect(block.id, { mode: 'replace', edit: false });
              }
            }}
            className="absolute left-[14px] w-[18px] h-[18px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors duration-100"
            title="右键更多操作"
          >
            {hasChildren && block.collapsed ? (
              // 折叠状态：空心圆环
              <div
                className="rounded-full transition-all duration-150 ease-in-out"
                style={{
                  width: '6px',
                  height: '6px',
                  border: '1.2px solid #cbd5e1',
                  backgroundColor: 'transparent',
                }}
              />
            ) : (
              // 展开或无子节点：实心小圆点
              <div
                className="rounded-full transition-all duration-150 ease-in-out"
                style={{
                  width: '4px',
                  height: '4px',
                  backgroundColor: '#cbd5e1',
                }}
              />
            )}
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
        </div>
      </div>

      {/* 块内容编辑器 */}
      <div className="flex-1 min-w-0">
        {showImagePreview ? (
          <button
            type="button"
            onClick={() => onSelect(block.id, { mode: 'replace', edit: true })}
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
              src={displayImageUrl || ''}
              alt={parsedImage?.alt}
              className="max-h-80 max-w-full rounded border border-[var(--color-border-subtle)] object-contain"
            />
          </button>
        ) : parsedImage && !isEditing && resolvedImageUrl === null ? (
          // 图片解析成功但加载失败，显示错误提示
          <div className="relative">
            <div
              onClick={() => onSelect(block.id, { mode: 'replace', edit: true })}
              className="w-full cursor-pointer rounded border border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-700 p-3 transition-colors hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 text-sm">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">图片文件未找到</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-all font-mono">{parsedImage.url}</p>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-1">点击编辑以更新图片路径</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={displayContentRef}
              tabIndex={isEditing ? -1 : 0}
              role="button"
              onClick={(event) => {
                // 检测是否发生了拖拽（鼠标移动超过5像素）
                const mouseDownPos = mouseDownPositionRef.current;
                const hasDragged = mouseDownPos && (
                  Math.abs(event.clientX - mouseDownPos.x) > 5 ||
                  Math.abs(event.clientY - mouseDownPos.y) > 5
                );

                // Shift 键：范围选择（不编辑）
                if (event.shiftKey) {
                  onSelect(block.id, { mode: 'range', edit: false });
                  return;
                }
                // Cmd/Ctrl 键：切换选择（不编辑）
                if (event.metaKey || event.ctrlKey) {
                  onSelect(block.id, { mode: 'toggle', edit: false });
                  return;
                }
                // 如果发生了拖拽，不做处理（选择已经在拖拽过程中更新）
                if (hasDragged) {
                  return;
                }
                // 如果有多个块被选中且当前块也被选中，点击进入编辑模式
                if (selectionCount > 1 && isSelected) {
                  const caret = pendingCursorRef.current;
                  onSelect(block.id, { mode: 'replace', edit: true, caret: caret ?? undefined });
                  return;
                }
                // 如果有多个块被选中但当前块未被选中，取消多选并选中当前块（不编辑）
                if (selectionCount > 1 && !isSelected) {
                  onSelect(block.id, { mode: 'replace', edit: false });
                  return;
                }
                // 普通点击：如果已选中则进入编辑，否则仅选中
                if (isSelected && !isEditing) {
                  // 已选中，进入编辑模式
                  const caret = pendingCursorRef.current;
                  onSelect(block.id, { mode: 'replace', edit: true, caret: caret ?? undefined });
                } else if (!isSelected) {
                  // 未选中，仅选中不编辑
                  onSelect(block.id, { mode: 'replace', edit: false });
                }
                // 如果已经在编辑，不做处理（保持编辑状态）
              }}
              onDoubleClick={(event) => {
                // 双击：直接进入编辑模式
                event.preventDefault();
                if (!isEditing) {
                  updatePendingCursorFromPoint(event.clientX, event.clientY);
                  const caret = pendingCursorRef.current;
                  onSelect(block.id, { mode: 'replace', edit: true, caret: caret ?? undefined });
                }
              }}
              onFocus={(event) => {
                if (event.target === event.currentTarget && !isSelected) {
                  // 通过键盘聚焦时，仅选中不编辑
                  onSelect(block.id, { mode: 'replace', edit: false });
                }
              }}
              onMouseDown={handleDisplayMouseDown}
              onTouchStart={handleDisplayTouchStart}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSelect(block.id, { mode: 'replace', edit: true });
                  return;
                }
                if ((event.key === 'Backspace' || event.key === 'Delete') && isSelected && !isEditing) {
                  event.preventDefault();
                  if (selectionCount > 1) {
                    onDeleteSelection();
                  } else {
                    onDelete(block.id);
                  }
                }
              }}
              className={`w-full cursor-text py-0.5 px-1 rounded-sm outline-none focus:ring-0 text-[var(--color-text-primary)] whitespace-pre-wrap break-words ${
                isEditing ? 'pointer-events-none select-none' : ''
              }`}
              style={{
                lineHeight: '1.5',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                visibility: isEditing ? 'hidden' : 'visible'
              }}
              aria-hidden={isEditing}
            >
              {renderDisplayContent(isEditing ? content : block.content)}
            </div>
            {isEditing && (
              <textarea
                ref={textareaRef}
                data-block-textarea={block.id}
                value={content}
                onChange={handleChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={handleKeyDown}
                onMouseDown={handleTextareaMouseDown}
              onMouseMove={handleTextareaMouseMove}
                onMouseLeave={handleTextareaMouseLeave}
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
                autoFocus={isEditing}
                className="absolute inset-0 w-full h-full resize-none border-none outline-none bg-transparent py-0.5 px-1 rounded-sm
                           focus:ring-0 focus:outline-none
                           text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] selection:bg-blue-200/50"
                style={{
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere'
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
