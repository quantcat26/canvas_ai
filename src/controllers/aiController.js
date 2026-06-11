import aiService from '../services/aiService.js';
import aiConfigService from '../services/aiConfigService.js';
import { AppError } from '../errors/AppError.js';
import { sendApiError } from '../utils/apiResponse.js';
import { isPlainObject, parseOptionalBoolean, parseOptionalNumber } from '../utils/validation.js';

const ALLOWED_ATTACHMENT_TYPES = new Set(['image', 'video', 'pdf', 'document']);

// ---- AI Config validation ----

const normalizeAiConfig = (value) => {
  if (!isPlainObject(value)) return null;

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '';
  const model = typeof value.model === 'string' ? value.model.trim() : '';

  if (!id || !name || !baseUrl || !model) return null;

  return {
    id,
    name,
    baseUrl,
    model,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    systemPrompt: typeof value.systemPrompt === 'string' ? value.systemPrompt.trim() : '',
    temperature: parseOptionalNumber(value.temperature, { min: 0, max: 2 }),
    maxTokens: parseOptionalNumber(value.maxTokens, { min: 1 }),
    path: typeof value.path === 'string' && value.path.trim() ? value.path.trim() : '/chat/completions',
    headerName: typeof value.headerName === 'string' && value.headerName.trim() ? value.headerName.trim() : 'Authorization',
    headerPrefix: typeof value.headerPrefix === 'string' ? value.headerPrefix : 'Bearer ',
    allowImages: parseOptionalBoolean(value.allowImages) ?? false,
    allowVideos: parseOptionalBoolean(value.allowVideos) ?? false,
    allowPdfs: parseOptionalBoolean(value.allowPdfs) ?? false,
    allowDocuments: parseOptionalBoolean(value.allowDocuments) ?? false,
  };
};

// ---- Attachment validation ----

const normalizeAttachment = (attachment) => {
  if (!isPlainObject(attachment)) return null;

  const type = typeof attachment.type === 'string' ? attachment.type.trim().toLowerCase() : '';
  const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType.trim() : '';
  const name = typeof attachment.name === 'string' ? attachment.name.trim() : '';
  const data = typeof attachment.data === 'string' ? attachment.data.trim() : '';

  if (!type || !data) return null;
  if (!ALLOWED_ATTACHMENT_TYPES.has(type)) return null;

  return { type, mimeType, name, data };
};

// ---- Chat payload parsing ----

const parseChatPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'INVALID_REQUEST', 'The request format is incorrect; the body must be an object.');
  }

  const { message, configId, attachments } = payload;
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.map(normalizeAttachment).filter(Boolean)
    : [];

  if (trimmedMessage.length === 0 && normalizedAttachments.length === 0) {
    throw new AppError(400, 'INVALID_MESSAGE', 'Chat messages cannot be empty');
  }

  if (typeof configId !== 'string' || configId.trim().length === 0) {
    throw new AppError(400, 'INVALID_CONFIG_ID', 'configId must be a non-empty string');
  }

  return {
    message: trimmedMessage,
    configId: configId.trim(),
    attachments: normalizedAttachments,
  };
};

// ---- Permissions check ----

const isAttachmentAllowed = (attachment, config) => {
  switch (attachment.type) {
    case 'image': return Boolean(config.allowImages);
    case 'video': return Boolean(config.allowVideos);
    case 'pdf': return Boolean(config.allowPdfs);
    case 'document': return Boolean(config.allowDocuments);
    default: return false;
  }
};

// ---- Controller ----

class AIController {
  async chat(req, res) {
    try {
      const { message, configId, attachments } = parseChatPayload(req.body);
      const { configs } = await aiConfigService.load();
      const config = configs.find((item) => item.id === configId);

      if (!config) {
        throw new AppError(404, 'AI_CONFIG_NOT_FOUND', 'The specified AI configuration was not found.');
      }

      if (attachments.length > 0) {
        const blocked = attachments.filter((a) => !isAttachmentAllowed(a, config));
        if (blocked.length > 0) {
          const blockedTypes = [...new Set(blocked.map((a) => a.type))];
          throw new AppError(
            400, 'AI_MODALITY_DISABLED',
            `This AI configuration does not allow: ${blockedTypes.join(', ')}`,
            { blockedTypes },
          );
        }
      }

      const response = await aiService.askOpenAICompatible({
        message,
        attachments,
        model: config.model,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        provider: {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          path: config.path || '/chat/completions',
          headerName: config.headerName || 'Authorization',
          headerPrefix: config.headerPrefix ?? 'Bearer ',
        },
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
          code: error.code, status: error.status,
          message: error.message, details: error.details,
        });
        sendApiError(res, error.status, error.code, error.message, error.details);
        return;
      }
      console.error('AI chat request processing error:', error);
      sendApiError(res, 500, 'AI_CHAT_FAILED', 'Failed to process the AI request.');
    }
  }

  async getAvailableServices(_req, res) {
    try {
      res.status(200).json({
        services: [],
        models: {},
        preferred: null,
        mode: 'user-config',
        supportedProtocol: 'openai-compatible',
      });
    } catch (error) {
      console.error('Failed to load available AI services:', error);
      sendApiError(res, 500, 'AI_SERVICES_FAILED', 'Failed to load available AI services.');
    }
  }

  async getConfigs(_req, res) {
    try {
      const payload = await aiConfigService.load();
      const safeConfigs = payload.configs.map(({ apiKey, ...rest }) => rest);
      res.status(200).json({ configs: safeConfigs, activeConfigId: payload.activeConfigId });
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
        ? body.configs.map(normalizeAiConfig).filter(Boolean)
        : [];
      const activeConfigId = typeof body.activeConfigId === 'string' ? body.activeConfigId : '';

      const saved = await aiConfigService.save({ configs, activeConfigId });
      const safeConfigs = saved.configs.map(({ apiKey, ...rest }) => rest);
      res.status(200).json({ configs: safeConfigs, activeConfigId: saved.activeConfigId });
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
