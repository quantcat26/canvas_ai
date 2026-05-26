import aiService from '../services/aiService.js';
import aiConfigService from '../services/aiConfigService.js';
import { AppError } from '../errors/AppError.js';
import { sendApiError } from '../utils/apiResponse.js';

const isPlainObject = (value) => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeConfig = (value) => {
  if (!isPlainObject(value)) return null;

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!id || !name || !baseUrl || !model) return null;

  const systemPrompt = typeof value.systemPrompt === 'string' ? value.systemPrompt.trim() : '';

  const parseOptionalNumber = (input, { min, max } = {}) => {
    if (input === null || input === undefined || input === '') return null;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return null;
    if (min !== undefined && parsed < min) return null;
    if (max !== undefined && parsed > max) return null;
    return parsed;
  };

  const temperature = parseOptionalNumber(value.temperature, { min: 0, max: 2 });
  const maxTokens = parseOptionalNumber(value.maxTokens, { min: 1 });

  return {
    id,
    name,
    baseUrl,
    model,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    systemPrompt,
    temperature,
    maxTokens,
    path: typeof value.path === 'string' && value.path.trim() ? value.path.trim() : '/chat/completions',
    headerName: typeof value.headerName === 'string' && value.headerName.trim() ? value.headerName.trim() : 'Authorization',
    headerPrefix: typeof value.headerPrefix === 'string' ? value.headerPrefix : 'Bearer ',
  };
};

const parseChatPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'INVALID_REQUEST', 'The request format is incorrect; the body must be an object.');
  }

  const body = payload;
  const { message, configId } = body;

  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new AppError(400, 'INVALID_MESSAGE', 'Chat messages cannot be empty');
  }

  if (typeof configId !== 'string' || configId.trim().length === 0) {
    throw new AppError(400, 'INVALID_CONFIG_ID', 'configId must be a non-empty string');
  }

  return {
    message: message.trim(),
    configId: configId.trim(),
  };
};

class AIController {
  async chat(req, res) {
    try {
      const { message, configId } = parseChatPayload(req.body);
      const { configs } = await aiConfigService.load();
      const config = configs.find((item) => item.id === configId);

      if (!config) {
        throw new AppError(404, 'AI_CONFIG_NOT_FOUND', 'The specified AI configuration was not found.');
      }

      const provider = {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        path: config.path || '/chat/completions',
        headerName: config.headerName || 'Authorization',
        headerPrefix: config.headerPrefix ?? 'Bearer ',
      };

      const response = await aiService.askOpenAICompatible({
        message,
        model: config.model,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        provider,
      });

      if (!response || !response.text) {
        throw new AppError(502, 'AI_EMPTY_RESPONSE', 'The AI service returned an empty response.');
      }

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_CONFIG_SECRET_REQUIRED') {
        sendApiError(res, 500, 'AI_CONFIG_SECRET_REQUIRED', 'Set AI_CONFIG_SECRET to encrypt and store API keys.');
        return;
      }
      if (error instanceof AppError) {
        console.error('AI chat request failed:', {
          code: error.code,
          status: error.status,
          message: error.message,
          details: error.details,
        });
        sendApiError(res, error.status, error.code, error.message, error.details);
        return;
      }

      console.error('AI chat request processing error:', error);
      sendApiError(res, 500, 'AI_CHAT_FAILED', 'Failed to process the AI request.');
    }
  }

  async getAvailableServices(req, res) {
    try {
      res.status(200).json({
        services: [],
        models: {},
        preferred: null,
        mode: 'user-config',
        supportedProtocol: 'openai-compatible',
      });
    } catch (error) {
      console.error('An error occurred while obtaining available AI services:', error);
      sendApiError(res, 500, 'AI_SERVICES_FAILED', 'Failed to load available AI services.');
    }
  }

  async getConfigs(req, res) {
    try {
      const payload = await aiConfigService.load();
      const safeConfigs = payload.configs.map(({ apiKey, ...rest }) => rest);
      res.status(200).json({
        configs: safeConfigs,
        activeConfigId: payload.activeConfigId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_CONFIG_SECRET_REQUIRED') {
        sendApiError(res, 500, 'AI_CONFIG_SECRET_REQUIRED', 'Set AI_CONFIG_SECRET to encrypt and store API keys.');
        return;
      }
      console.error('Failed to load AI settings:', error);
      sendApiError(res, 500, 'AI_CONFIG_LOAD_FAILED', 'Failed to load AI settings.');
    }
  }

  async saveConfigs(req, res) {
    try {
      const body = isPlainObject(req.body) ? req.body : {};
      const configs = Array.isArray(body.configs)
        ? body.configs.map(normalizeConfig).filter(Boolean)
        : [];
      const activeConfigId = typeof body.activeConfigId === 'string'
        ? body.activeConfigId
        : '';

      const saved = await aiConfigService.save({
        configs,
        activeConfigId,
      });

      const safeConfigs = saved.configs.map(({ apiKey, ...rest }) => rest);
      res.status(200).json({
        configs: safeConfigs,
        activeConfigId: saved.activeConfigId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'AI_CONFIG_SECRET_REQUIRED') {
        sendApiError(res, 500, 'AI_CONFIG_SECRET_REQUIRED', 'Set AI_CONFIG_SECRET to encrypt and store API keys.');
        return;
      }
      console.error('Failed to save AI settings:', error);
      sendApiError(res, 500, 'AI_CONFIG_SAVE_FAILED', 'Failed to save AI settings.');
    }
  }
}

export default new AIController();
