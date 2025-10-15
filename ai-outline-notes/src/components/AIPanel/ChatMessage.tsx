// 聊天消息组件
import React from 'react';
import { User, Bot } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  onInsert?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  onInsert,
}) => {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white shadow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-button-bg)] text-[var(--color-text-primary)]'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{content}</div>
        </div>

        {!isUser && onInsert && (
          <button
            onClick={onInsert}
            className="mt-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            插入到笔记
          </button>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-button-bg)] flex items-center justify-center text-[var(--color-text-primary)]">
          <User className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};
