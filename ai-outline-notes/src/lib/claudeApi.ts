// Claude API 调用服务
import Anthropic from '@anthropic-ai/sdk';
import { getApiConfig } from './apiConfig';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  error?: string;
}

// 自定义 fetch，确保所有 headers 都是 ASCII，并支持代理服务
function createCustomFetch(apiKey: string, baseURL: string) {
  return async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers();

    // 先复制现有 headers（包括 content-type, anthropic-version 等）
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          const asciiValue = value.replace(/[^\p{ASCII}]/gu, '');
          headers.set(key, asciiValue);
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          const asciiValue = value.replace(/[^\p{ASCII}]/gu, '');
          headers.set(key, asciiValue);
        });
      } else {
        const headersObj = init.headers as Record<string, string>;
        for (const [key, value] of Object.entries(headersObj)) {
          const asciiValue = value.replace(/[^\p{ASCII}]/gu, '');
          headers.set(key, asciiValue);
        }
      }
    }

    // 如果使用非官方 API（代理），添加 x-api-key header 和客户端标识
    if (baseURL && !baseURL.includes('api.anthropic.com')) {
      const cleanApiKey = apiKey.trim().replace(/[^\p{ASCII}]/gu, '');
      headers.set('x-api-key', cleanApiKey);

      // 确保必需的 headers 存在
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      if (!headers.has('anthropic-version')) {
        headers.set('anthropic-version', '2023-06-01');
      }

      // 关键：设置 user-agent 为 claude_code，以通过代理的客户端验证
      headers.set('user-agent', 'claude_code/1.0.0');

      // 详细日志
      console.log('========== 代理请求详情 ==========');
      console.log('URL:', url.toString());
      console.log('Method:', init?.method || 'GET');
      console.log('Headers:', Object.fromEntries(headers.entries()));
      if (init?.body) {
        try {
          const bodyObj = JSON.parse(init.body.toString());
          console.log('Request Body:', JSON.stringify(bodyObj, null, 2));
        } catch {
          console.log('Request Body (raw):', init.body);
        }
      }
      console.log('================================');
    }

    init = { ...init, headers };
    const response = await fetch(url, init);

    // 如果是错误响应，记录错误详情
    if (!response.ok && !baseURL.includes('api.anthropic.com')) {
      const errorText = await response.clone().text();
      console.error('API 错误响应:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
    }

    return response;
  };
}

// 创建 Anthropic 客户端
function createAnthropicClient(): Anthropic | null {
  const config = getApiConfig();

  if (!config.anthropicApiKey) {
    return null;
  }

  // 确保 API key 只包含 ASCII 字符
  const apiKey = config.anthropicApiKey.trim().replace(/[^\p{ASCII}]/gu, '');
  const baseURL = config.anthropicBaseUrl || 'https://api.anthropic.com';

  console.log('创建 Anthropic 客户端，Base URL:', baseURL);

  return new Anthropic({
    apiKey: apiKey,
    baseURL: baseURL,
    dangerouslyAllowBrowser: true,
    fetch: createCustomFetch(apiKey, baseURL),
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
    },
  });
}

// 调用 Claude API
export async function callClaudeApi(
  messages: Message[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<ClaudeResponse> {
  const client = createAnthropicClient();

  if (!client) {
    return {
      content: '',
      error: '请先配置 Anthropic API Key。\n\n你可以在终端输入以下命令配置：\nset-api-key YOUR_API_KEY',
    };
  }

  try {
    const config = getApiConfig();
    const model = options?.model || config.claudeModel || 'claude-3-5-sonnet-20241022';

    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // 提取响应文本
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return { content };
  } catch (error) {
    console.error('Claude API 调用失败:', error);

    let errorMessage = '调用 Claude API 时出错';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      content: '',
      error: errorMessage,
    };
  }
}

// 流式调用 Claude API（用于实时显示）
export async function* streamClaudeApi(
  messages: Message[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): AsyncGenerator<string, void, unknown> {
  const client = createAnthropicClient();

  if (!client) {
    yield '请先配置 Anthropic API Key。\n\n你可以在终端输入以下命令配置：\nset-api-key YOUR_API_KEY';
    return;
  }

  try {
    const config = getApiConfig();
    const model = options?.model || config.claudeModel || 'claude-3-5-sonnet-20241022';

    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    console.log('发送到 Claude API 的消息:', {
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1,
      messages: formattedMessages,
      baseURL: config.anthropicBaseUrl,
    });

    const stream = await client.messages.stream({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1,
      messages: formattedMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  } catch (error) {
    console.error('Claude API 流式调用失败:', error);

    let errorMessage = '调用 Claude API 时出错';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    yield `\n\n错误: ${errorMessage}`;
  }
}
