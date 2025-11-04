// API 配置管理
const STORAGE_KEY = 'ai-outline-notes-api-config';

export interface ApiConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  claudeModel?: string;
  anthropicBaseUrl?: string;
}

// 默认配置
const defaultConfig: ApiConfig = {
  claudeModel: 'claude-3-5-sonnet-20241022', // 使用最新的 Claude 3.5 Sonnet
  anthropicBaseUrl: 'https://api.anthropic.com', // 默认使用官方 API
};

// 获取 API 配置
export function getApiConfig(): ApiConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('读取 API 配置失败:', error);
  }
  return defaultConfig;
}

// 保存 API 配置
export function saveApiConfig(config: Partial<ApiConfig>): void {
  try {
    const current = getApiConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('保存 API 配置失败:', error);
    throw error;
  }
}

// 设置 Anthropic API Key
export function setAnthropicApiKey(apiKey: string): void {
  saveApiConfig({ anthropicApiKey: apiKey });
}

// 获取 Anthropic API Key
export function getAnthropicApiKey(): string | undefined {
  return getApiConfig().anthropicApiKey;
}

// 检查是否配置了 API Key
export function hasAnthropicApiKey(): boolean {
  const key = getAnthropicApiKey();
  return !!key && key.trim().length > 0;
}

// 设置 Base URL
export function setAnthropicBaseUrl(baseUrl: string): void {
  saveApiConfig({ anthropicBaseUrl: baseUrl });
}

// 获取 Base URL
export function getAnthropicBaseUrl(): string {
  return getApiConfig().anthropicBaseUrl || 'https://api.anthropic.com';
}
