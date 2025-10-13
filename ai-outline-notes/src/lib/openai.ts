// OpenAI API 集成
import OpenAI from 'openai';

// 注意：在生产环境中，API Key 应该通过后端代理，而不是直接在前端使用
let openaiClient: OpenAI | null = null;

export function initializeOpenAI(apiKey: string) {
  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // 仅用于开发/演示
  });
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
    throw new Error('OpenAI 未初始化。请先设置 API Key。');
  }

  const stream = await openaiClient.chat.completions.create({
    model: options?.model || 'gpt-3.5-turbo',
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
    throw new Error('OpenAI 未初始化。请先设置 API Key。');
  }

  const response = await openaiClient.chat.completions.create({
    model: options?.model || 'gpt-3.5-turbo',
    messages,
    temperature: options?.temperature || 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

// 估算 token 数量（简单估算，1 token ≈ 4 个字符）
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

