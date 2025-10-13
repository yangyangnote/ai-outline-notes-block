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
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{content}</div>
        </div>

        {!isUser && onInsert && (
          <button
            onClick={onInsert}
            className="mt-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            插入到笔记
          </button>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
};

