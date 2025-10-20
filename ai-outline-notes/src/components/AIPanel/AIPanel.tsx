// AI 对话面板
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Settings } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { streamChatCompletion, isOpenAIInitialized, initializeOpenAI } from '../../lib/openai';
import { createBlock } from '../../utils/blockUtils';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageId: string | null;
  currentPageTitle: string;
  selectedBlockContent?: string;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  onClose,
  currentPageId,
  currentPageTitle,
  selectedBlockContent,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 检查是否已设置 API Key
  useEffect(() => {
    const saved = localStorage.getItem('openai_api_key');
    if (saved) {
      setApiKey(saved);
      if (!isOpenAIInitialized()) {
        initializeOpenAI(saved);
      }
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!isOpenAIInitialized()) {
      alert('请先设置 OpenAI API Key');
      setShowSettings(true);
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // 构建上下文
    const contextMessages = [
      {
        role: 'system' as const,
        content: `你是一个智能笔记助手。当前用户正在编辑笔记《${currentPageTitle}》。请提供有帮助的、简洁的回答。`,
      },
      ...messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      {
        role: 'user' as const,
        content: selectedBlockContent
          ? `选中的笔记内容：\n${selectedBlockContent}\n\n用户问题：${input}`
          : input,
      },
    ];

    // 创建 AI 响应消息
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 流式接收响应
      let fullContent = '';
      for await (const chunk of streamChatCompletion(contextMessages)) {
        fullContent += chunk;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId ? { ...m, content: fullContent } : m
          )
        );
      }
    } catch (error) {
      console.error('AI 响应错误:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: '抱歉，发生了错误。请检查 API Key 或网络连接。' }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleInsertToNote = async (content: string) => {
    if (!currentPageId) return;

    // 创建新块
    await createBlock(currentPageId, content);
    alert('已插入到笔记');
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey);
      initializeOpenAI(apiKey);
      setShowSettings(false);
      alert('API Key 已保存');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[var(--color-editor-bg)] border-l border-[var(--color-border-strong)] flex flex-col shadow-lg z-50 transition-colors duration-200">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-strong)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">AI 助手</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded transition-colors duration-200 hover:bg-[var(--color-block-hover-bg)]"
            title="设置"
          >
            <Settings className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded transition-colors duration-200 hover:bg-[var(--color-block-hover-bg)]"
            title="关闭"
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="p-4 bg-[var(--color-callout-bg)] border-b border-[var(--color-border-strong)] rounded-none">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            OpenAI API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-md mb-2 bg-[var(--color-input-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)] transition-colors duration-200"
          />
          <button
            onClick={handleSaveApiKey}
            className="w-full px-3 py-2 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 transition-opacity"
          >
            保存
          </button>
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            注意：API Key 存储在本地，仅用于开发演示。
          </p>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] mt-8">
            <p>开始与 AI 助手对话</p>
            <p className="text-sm mt-2 text-[var(--color-text-secondary)]">选中笔记内容后提问，AI 会基于上下文回答</p>
          </div>
        ) : (
          messages.map(message => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              onInsert={
                message.role === 'assistant'
                  ? () => handleInsertToNote(message.content)
                  : undefined
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="p-4 border-t border-[var(--color-border-strong)]">
        {selectedBlockContent && (
          <div className="mb-2 p-2 bg-[var(--color-block-selected-bg)] rounded text-sm text-[var(--color-text-primary)]">
            <span className="font-medium">选中内容：</span>
            <span className="text-[var(--color-text-secondary)]">
              {selectedBlockContent.slice(0, 50)}
              {selectedBlockContent.length > 50 ? '...' : ''}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入问题...（Enter 发送，Shift+Enter 换行）"
            className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-md resize-none bg-[var(--color-input-bg)] text-[var(--color-text-primary)] placeholder:text-[var(--color-input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)] transition-colors duration-200"
            rows={3}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-md hover:opacity-90 
                     disabled:bg-[var(--color-border-subtle)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed
                     flex items-center justify-center transition-colors duration-200"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {isStreaming && (
          <div className="mt-2 text-sm text-[var(--color-text-muted)]">AI 正在思考...</div>
        )}
      </div>
    </div>
  );
};
