// 大纲编辑器主组件
import React, { useEffect, useState } from 'react';
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
  toggleBlockCollapse 
} from '../../utils/blockUtils';
import type { Block } from '../../types';

interface OutlineEditorProps {
  pageId: string;
  onBlockSelect?: (blockId: string | null, content: string) => void;
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({ 
  pageId,
  onBlockSelect 
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);

  // 实时查询页面的所有块
  const liveBlocks = useLiveQuery(
    () => getPageBlocks(pageId),
    [pageId]
  );

  useEffect(() => {
    if (liveBlocks) {
      setBlocks(liveBlocks);
    }
  }, [liveBlocks]);

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
    const blockMap = new Map(blocks.map(b => [b.id, b]));
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
  };

  const handleFocusPrevious = (currentId: string) => {
    const currentIndex = flatTree.findIndex(b => b.id === currentId);
    if (currentIndex > 0) {
      setSelectedBlockId(flatTree[currentIndex - 1].id);
    }
  };

  const handleFocusNext = (currentId: string) => {
    const currentIndex = flatTree.findIndex(b => b.id === currentId);
    if (currentIndex < flatTree.length - 1) {
      setSelectedBlockId(flatTree[currentIndex + 1].id);
    }
  };

  const handleToggleCollapse = async (blockId: string) => {
    await toggleBlockCollapse(blockId);
  };

  // 检查块是否有子块
  const hasChildren = (blockId: string): boolean => {
    return blocks.some(b => b.parentId === blockId);
  };

  const handleCreateFirstBlock = async () => {
    const newBlock = await createBlock(pageId, '');
    setSelectedBlockId(newBlock.id);
    if (onBlockSelect) {
      onBlockSelect(newBlock.id, '');
    }
  };

  return (
    <div className="outline-editor h-full overflow-y-auto p-4 bg-[var(--color-editor-bg)] transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        {flatTree.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <p className="mb-4">还没有内容，点击下方按钮开始记录。</p>
            <button
              onClick={handleCreateFirstBlock}
              className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 transition-opacity"
            >
              创建第一条笔记
            </button>
          </div>
        ) : (
          flatTree.map(block => (
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
            />
          ))
        )}
      </div>
    </div>
  );
};
