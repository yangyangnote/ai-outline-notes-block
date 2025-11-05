// OpenAI/DeepSeek API 集成（使用 OpenAI SDK 兼容层）
import OpenAI from 'openai';
import type { ClientOptions as OpenAIClientOptions } from 'openai';

// 注意：在生产环境中，API Key 应该通过后端代理，而不是直接在前端使用
let openaiClient: OpenAI | null = null;
let defaultModel = 'gpt-3.5-turbo';

type InitializeOptions = {
  baseURL?: string;
  defaultModel?: string;
  headers?: OpenAIClientOptions['defaultHeaders'];
};

export function initializeOpenAI(apiKey: string, options: InitializeOptions = {}) {
  defaultModel = options.defaultModel ?? 'gpt-3.5-turbo';

  const clientConfig: OpenAIClientOptions = {
    apiKey,
    baseURL: options.baseURL || undefined,
    defaultHeaders: options.headers,
    dangerouslyAllowBrowser: true, // 仅用于开发/演示
  };

  openaiClient = new OpenAI(clientConfig);
}

export function resetOpenAIClient() {
  openaiClient = null;
  defaultModel = 'gpt-3.5-turbo';
}

export function isOpenAIInitialized(): boolean {
  return openaiClient !== null;
}

export async function* streamChatCompletion(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
  }
): AsyncGenerator<string, void, unknown> {
  if (!openaiClient) {
    throw new Error('AI 客户端未初始化。请先设置 API Key。');
  }

  const stream = await openaiClient.chat.completions.create({
    model: options?.model || defaultModel,
    messages,
    temperature: options?.temperature || 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

export async function getChatCompletion(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<string> {
  if (!openaiClient) {
    throw new Error('AI 客户端未初始化。请先设置 API Key。');
  }

  const response = await openaiClient.chat.completions.create({
    model: options?.model || defaultModel,
    messages,
    temperature: options?.temperature || 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

// 估算 token 数量（简单估算，1 token ≈ 4 个字符）
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
