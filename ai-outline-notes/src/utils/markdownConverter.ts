// Markdown 序列化和反序列化工具
// 用于在应用内部数据结构和 Markdown 文件之间转换

import type { Page, Block } from '../types';

// ==================== 序列化：数据 → Markdown ====================

export interface MarkdownExportOptions {
  includeBlockIds?: boolean;  // 是否包含块 ID 标记
  indentSize?: number;         // 缩进空格数
}

// 将页面和块转换为 Markdown 格式
export function pageToMarkdown(
  page: Page,
  blocks: Block[],
  options: MarkdownExportOptions = {}
): string {
  const { includeBlockIds = true, indentSize = 2 } = options;

  // 生成 YAML frontmatter
  const frontmatter = generateFrontmatter(page);

  // 生成块内容
  const content = blocksToMarkdown(blocks, includeBlockIds, indentSize);

  return `${frontmatter}\n${content}`.trim() + '\n';
}

// 生成 YAML frontmatter
function generateFrontmatter(page: Page): string {
  const metadata = {
    id: page.id,
    title: page.title,
    type: page.type,
    created: new Date(page.createdAt).toISOString(),
    updated: new Date(page.updatedAt).toISOString(),
  };

  const yaml = Object.entries(metadata)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n');

  return `---\n${yaml}\n---\n`;
}

// 将块数组转换为 Markdown 内容
function blocksToMarkdown(
  blocks: Block[],
  includeBlockIds: boolean,
  indentSize: number
): string {
  // 构建块的层级树
  const blockMap = new Map(blocks.map(b => [b.id, b]));
  const rootBlocks = blocks
    .filter(b => !b.parentId)
    .sort((a, b) => a.order - b.order);

  const lines: string[] = [];

  function processBlock(block: Block, depth: number = 0) {
    const indent = ' '.repeat(depth * indentSize);
    const blockId = includeBlockIds ? ` ^${block.id}` : '';
    
    // 处理块内容（可能是多行）
    const contentLines = block.content.split('\n');
    
    contentLines.forEach((line, index) => {
      if (index === 0) {
        // 第一行添加列表标记和块 ID
        const prefix = depth === 0 ? '- ' : '- ';
        lines.push(`${indent}${prefix}${line}${index === contentLines.length - 1 ? blockId : ''}`);
      } else if (index === contentLines.length - 1) {
        // 最后一行添加块 ID
        lines.push(`${indent}  ${line}${blockId}`);
      } else {
        // 中间行正常缩进
        lines.push(`${indent}  ${line}`);
      }
    });

    // 如果块没有被折叠，处理子块
    if (!block.collapsed) {
      const children = blocks
        .filter(b => b.parentId === block.id)
        .sort((a, b) => a.order - b.order);

      children.forEach(child => processBlock(child, depth + 1));
    }
  }

  rootBlocks.forEach(block => processBlock(block, 0));

  return lines.join('\n');
}

// ==================== 反序列化：Markdown → 数据 ====================

export interface ParsedMarkdown {
  page: Partial<Page>;
  blocks: Block[];
}

// 解析 Markdown 文件
export function markdownToPage(
  content: string,
  filename: string
): ParsedMarkdown {
  // 分离 frontmatter 和内容
  const { frontmatter, bodyContent } = parseFrontmatter(content);

  // 解析页面元数据
  const page: Partial<Page> = {
    id: frontmatter.id || crypto.randomUUID(),
    title: frontmatter.title || filenameToTitle(filename),
    type: (frontmatter.type as 'note' | 'daily') || 'note',
    createdAt: frontmatter.created ? new Date(frontmatter.created).getTime() : Date.now(),
    updatedAt: frontmatter.updated ? new Date(frontmatter.updated).getTime() : Date.now(),
    isReference: false,
  };

  // 解析块内容
  const blocks = parseBlocks(bodyContent, page.id!);

  return { page, blocks };
}

// 解析 YAML frontmatter
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  bodyContent: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, bodyContent: content };
  }

  const frontmatterText = match[1];
  const bodyContent = content.slice(match[0].length);

  const frontmatter: Record<string, string> = {};
  
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  });

  return { frontmatter, bodyContent };
}

// 解析块内容
function parseBlocks(content: string, pageId: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  const blockStack: Array<{ block: Block; depth: number }> = [];

  let currentBlockLines: string[] = [];
  let currentDepth = 0;
  let currentBlockId: string | null = null;

  function flushCurrentBlock() {
    if (currentBlockLines.length === 0) return;

    const blockContent = currentBlockLines.join('\n').trim();
    if (!blockContent) return;

    // 提取块 ID（如果有）
    const blockIdMatch = blockContent.match(/\s*\^([a-zA-Z0-9-]+)\s*$/);
    const cleanContent = blockIdMatch
      ? blockContent.slice(0, blockIdMatch.index).trim()
      : blockContent;

    const blockId = currentBlockId || blockIdMatch?.[1] || crypto.randomUUID();

    // 确定父块
    let parentId: string | null = null;
    for (let i = blockStack.length - 1; i >= 0; i--) {
      if (blockStack[i].depth < currentDepth) {
        parentId = blockStack[i].block.id;
        break;
      }
    }

    // 计算同级排序
    const siblings = blocks.filter(b => b.parentId === parentId);
    const order = siblings.length;

    const block: Block = {
      id: blockId,
      content: cleanContent,
      parentId,
      pageId,
      order,
      collapsed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    blocks.push(block);
    
    // 更新栈
    while (blockStack.length > 0 && blockStack[blockStack.length - 1].depth >= currentDepth) {
      blockStack.pop();
    }
    blockStack.push({ block, depth: currentDepth });

    // 重置
    currentBlockLines = [];
    currentBlockId = null;
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    // 检测是否是列表项
    const listMatch = line.match(/^(\s*)- (.*)$/);
    
    if (listMatch) {
      // 完成前一个块
      flushCurrentBlock();

      // 开始新块
      const indent = listMatch[1];
      currentDepth = Math.floor(indent.length / 2);
      currentBlockLines.push(listMatch[2]);
    } else {
      // 继续当前块的内容
      currentBlockLines.push(line.trim());
    }
  }

  // 完成最后一个块
  flushCurrentBlock();

  return blocks;
}

// 从文件名提取标题
function filenameToTitle(filename: string): string {
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
}

// ==================== 工具函数 ====================

// 验证 Markdown 格式是否有效
export function validateMarkdown(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 检查 frontmatter
  if (!content.startsWith('---')) {
    errors.push('缺少 YAML frontmatter');
  }

  // 检查基本结构
  const { frontmatter } = parseFrontmatter(content);
  if (!frontmatter.id) {
    errors.push('frontmatter 缺少 id 字段');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 估算块的深度（从内容格式判断）
export function estimateBlockDepth(line: string): number {
  const match = line.match(/^(\s*)- /);
  if (!match) return 0;
  return Math.floor(match[1].length / 2);
}

