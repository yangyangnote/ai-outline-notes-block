// 主应用组件
import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { OutlineEditor } from './components/Editor/OutlineEditor';
import { AIPanel } from './components/AIPanel/AIPanel';
import { initializeDatabase, db } from './db/database';
import { cleanupDuplicatePages } from './utils/dbMaintenance';
import { initDevTools } from './utils/devTools';
import type { Page } from './types';

function App() {
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null>(null);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedBlockContent, setSelectedBlockContent] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化数据库
  useEffect(() => {
    const init = async () => {
      await initializeDatabase();
      
      // 清理重复的页面（如果有）
      await cleanupDuplicatePages();
      
      // 加载开发工具（仅开发环境）
      if (import.meta.env.DEV) {
        initDevTools();
      }
      
      // 加载第一个页面
      const pages = await db.pages.orderBy('updatedAt').reverse().limit(1).toArray();
      if (pages.length > 0) {
        setCurrentPageId(pages[0].id);
      }
      
      setIsInitialized(true);
    };
    
    init();
  }, []);

  // 加载当前页面信息
  useEffect(() => {
    if (currentPageId) {
      db.pages.get(currentPageId).then(page => {
        if (page) {
          setCurrentPage(page);
        }
      });
    }
  }, [currentPageId]);

  const handlePageSelect = (pageId: string) => {
    setCurrentPageId(pageId);
    setSelectedBlockContent(''); // 切换页面时清空选中内容
  };

  const handleBlockSelect = (blockId: string | null, content: string) => {
    setSelectedBlockContent(content);
  };

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">初始化中...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* 左侧边栏 */}
      <Sidebar
        currentPageId={currentPageId}
        onPageSelect={handlePageSelect}
      />

      {/* 主编辑区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentPage?.title || '选择一个页面'}
            </h2>
            {currentPage && (
              <span className="text-sm text-gray-500">
                {currentPage.type === 'daily' ? '日记' : '笔记'}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              isAIPanelOpen
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>AI 助手</span>
          </button>
        </div>

        {/* 编辑器 */}
        <div className="flex-1 overflow-hidden">
          {currentPageId ? (
            <OutlineEditor
              pageId={currentPageId}
              onBlockSelect={handleBlockSelect}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              请选择或创建一个页面开始编辑
            </div>
          )}
        </div>
      </div>

      {/* AI 对话面板 */}
      <AIPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        currentPageId={currentPageId}
        currentPageTitle={currentPage?.title || ''}
        selectedBlockContent={selectedBlockContent}
      />
    </div>
  );
}

export default App;
