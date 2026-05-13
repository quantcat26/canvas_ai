import axios from 'axios';
import { AppError } from '../errors/AppError.js';

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');
const normalizePath = (value) => (value.startsWith('/') ? value : `/${value}`);

const extractProviderErrorDetails = (data) => {
  if (!data) return { providerMessage: null, providerCode: null };

  if (typeof data === 'string') {
    return { providerMessage: data, providerCode: null };
  }

  if (typeof data === 'object') {
    const providerMessage =
      (typeof data.error?.message === 'string' && data.error.message) ||
      (typeof data.message === 'string' && data.message) ||
      null;
    const providerCode =
      (typeof data.error?.code === 'string' && data.error.code) ||
      (typeof data.code === 'string' && data.code) ||
      null;

    return { providerMessage, providerCode };
  }

  return { providerMessage: null, providerCode: null };
};

class AIService {
  async askOpenAICompatible({ message, model, systemPrompt, temperature, maxTokens, provider }) {
    const baseUrl = normalizeBaseUrl(provider.baseUrl);
    const path = normalizePath(provider.path || '/chat/completions');
    const url = `${baseUrl}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(provider.headers || {}),
    };

    if (provider.apiKey) {
      const headerName = provider.headerName || 'Authorization';
      const headerPrefix = provider.headerPrefix === undefined ? 'Bearer ' : provider.headerPrefix;
      headers[headerName] = headerPrefix ? `${headerPrefix}${provider.apiKey}` : provider.apiKey;
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    const payload = {
      model,
      messages,
    };

    if (temperature !== null && temperature !== undefined) {
      payload.temperature = temperature;
    }

    if (maxTokens !== null && maxTokens !== undefined) {
      payload.max_tokens = maxTokens;
    }

    try {
      const response = await axios.post(
        url,
        payload,
        { headers },
      );

      const text = response?.data?.choices?.[0]?.message?.content;

      if (!text) {
        throw new AppError(502, 'AI_INVALID_RESPONSE', 'The AI response format is not compatible with OpenAI.');
      }

      return {
        text,
        source: `${provider.baseUrl} (${model})`,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const providerData = error.response?.data;
        const { providerMessage, providerCode } = extractProviderErrorDetails(providerData);

        console.error('AI provider request failed:', {
          url,
          model,
          status: error.response?.status,
          providerMessage,
          providerCode,
        });

        throw new AppError(
          error.response?.status || 502,
          'AI_REQUEST_FAILED',
          providerMessage ? `AI request failed: ${providerMessage}` : 'AI request failed',
          {
            message: error.message,
            providerStatus: error.response?.status,
            providerMessage,
            providerCode,
          },
        );
      }

      console.error('AI provider request failed (unexpected error):', {
        url,
        model,
        message: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(
        502,
        'AI_REQUEST_FAILED',
        'AI request failed',
        error instanceof Error ? { message: error.message } : undefined,
      );
    }
  }
}

export default new AIService();
