// Vault 选择界面
// 用于首次启动或切换笔记库

import React, { useState } from 'react';
import { Folder, FolderOpen, AlertCircle, Info } from 'lucide-react';
import {
  isFileSystemSupported,
  requestVaultAccess,
  saveVaultHandle,
  getVaultName,
} from '../../lib/fileSystem';
import { initializeVaultStructure } from '../../utils/fileOperations';

interface VaultSelectorProps {
  onVaultSelected: (vaultHandle: FileSystemDirectoryHandle) => void;
}

export const VaultSelector: React.FC<VaultSelectorProps> = ({ onVaultSelected }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSelectVault = async () => {
    setIsSelecting(true);
    setError('');

    try {
      // 检查浏览器支持
      if (!isFileSystemSupported()) {
        setError('当前浏览器不支持文件系统访问。请使用 Chrome 86+、Edge 86+ 或其他兼容浏览器。');
        setIsSelecting(false);
        return;
      }

      // 请求用户选择文件夹
      const vaultHandle = await requestVaultAccess();

      // 初始化 vault 结构
      await initializeVaultStructure(vaultHandle);

      // 保存句柄
      await saveVaultHandle(vaultHandle);

      // 通知父组件
      onVaultSelected(vaultHandle);
    } catch (err) {
      console.error('选择 vault 失败:', err);
      if (err instanceof Error) {
        if (err.message.includes('取消')) {
          setError('');  // 用户取消不显示错误
        } else {
          setError(err.message);
        }
      } else {
        setError('选择文件夹失败，请重试');
      }
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-2xl w-full">
        {/* 主卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12">
          {/* 图标和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6">
              <Folder className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              欢迎使用 AI 大纲笔记
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              选择一个文件夹来存储你的笔记
            </p>
          </div>

          {/* 说明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="font-semibold mb-2">什么是 Vault（笔记库）？</p>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• 你的所有笔记将以 Markdown 文件形式存储在这个文件夹中</li>
                  <li>• 你可以使用任何文本编辑器查看和编辑这些文件</li>
                  <li>• 数据完全属于你，可以备份、同步或分享</li>
                  <li>• 兼容 Obsidian 和 Logseq 等其他笔记应用</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 选择按钮 */}
          <button
            onClick={handleSelectVault}
            disabled={isSelecting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSelecting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>正在初始化...</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-5 h-5" />
                <span>选择笔记文件夹</span>
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* 浏览器兼容性提示 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              需要 Chrome 86+、Edge 86+ 或其他支持 File System Access API 的浏览器
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>首次使用？应用会自动创建必要的文件夹结构</p>
          <p className="mt-2">已有笔记文件夹？直接选择即可导入现有笔记</p>
        </div>
      </div>
    </div>
  );
};

