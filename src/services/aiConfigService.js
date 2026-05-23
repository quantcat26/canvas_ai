import crypto from 'crypto';
import { ensureMigrated, getDb } from './db.js';

const ENCRYPT_PREFIX = 'enc:v1:';
const KEY_SALT = 'canvas_ai_ai_config_v1';

const getKey = () => {
  const secret = process.env.AI_CONFIG_SECRET;
  if (!secret) {
    throw new Error('AI_CONFIG_SECRET_REQUIRED');
  }
  return crypto.scryptSync(secret, KEY_SALT, 32);
};

const encryptValue = (value) => {
  if (!value) return '';
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return `${ENCRYPT_PREFIX}${payload}`;
};

const decryptValue = (value) => {
  if (!value) return '';
  if (!value.startsWith(ENCRYPT_PREFIX)) return value;
  const key = getKey();
  const payload = Buffer.from(value.slice(ENCRYPT_PREFIX.length), 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

const ensureEncrypted = (value) => {
  if (!value) return '';
  return value.startsWith(ENCRYPT_PREFIX) ? value : encryptValue(value);
};

class AiConfigService {
  async load() {
    await ensureMigrated();
    const db = await getDb();

    const rows = db.prepare(`
      SELECT
        id, name, base_url, model, api_key_enc, system_prompt,
        temperature, max_tokens, path, header_name, header_prefix
      FROM ai_config
    `).all();

    const activeRow = db.prepare(`
      SELECT value FROM app_setting WHERE key = 'activeConfigId'
    `).get();

    const decryptedConfigs = rows.map((row) => {
      try {
        return {
          id: row.id,
          name: row.name,
          baseUrl: row.base_url,
          model: row.model,
          apiKey: decryptValue(row.api_key_enc || ''),
          systemPrompt: row.system_prompt || '',
          temperature: row.temperature ?? null,
          maxTokens: row.max_tokens ?? null,
          path: row.path || '/chat/completions',
          headerName: row.header_name || 'Authorization',
          headerPrefix: row.header_prefix ?? 'Bearer ',
        };
      } catch (error) {
        console.warn('Failed to decrypt AI settings. Please re-enter the API key.', error);
        return {
          id: row.id,
          name: row.name,
          baseUrl: row.base_url,
          model: row.model,
          apiKey: '',
          systemPrompt: row.system_prompt || '',
          temperature: row.temperature ?? null,
          maxTokens: row.max_tokens ?? null,
          path: row.path || '/chat/completions',
          headerName: row.header_name || 'Authorization',
          headerPrefix: row.header_prefix ?? 'Bearer ',
        };
      }
    });

    return {
      configs: decryptedConfigs,
      activeConfigId: typeof activeRow?.value === 'string' ? activeRow.value : '',
    };
  }

  async save(payload) {
    await ensureMigrated();
    const db = await getDb();
    const configs = Array.isArray(payload?.configs) ? payload.configs : [];

    const existingRows = db.prepare('SELECT id, api_key_enc FROM ai_config').all();
    const existingApiKeyById = new Map(
      existingRows.map((row) => [row.id, row.api_key_enc || '']),
    );

    const now = new Date().toISOString();
    const upsertConfig = db.prepare(`
      INSERT INTO ai_config (
        id, name, base_url, model, api_key_enc, system_prompt,
        temperature, max_tokens, path, header_name, header_prefix,
        created_at, updated_at
      ) VALUES (
        @id, @name, @baseUrl, @model, @apiKeyEnc, @systemPrompt,
        @temperature, @maxTokens, @path, @headerName, @headerPrefix,
        @createdAt, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        model = excluded.model,
        api_key_enc = excluded.api_key_enc,
        system_prompt = excluded.system_prompt,
        temperature = excluded.temperature,
        max_tokens = excluded.max_tokens,
        path = excluded.path,
        header_name = excluded.header_name,
        header_prefix = excluded.header_prefix,
        updated_at = excluded.updated_at
    `);

    const saveConfigs = db.transaction((items) => {
      items.forEach((config) => {
        if (!config || typeof config !== 'object') return;
        const incomingKey = typeof config.apiKey === 'string' ? config.apiKey : '';
        const existingKey = typeof config.id === 'string'
          ? (existingApiKeyById.get(config.id) || '')
          : '';
        const apiKeyEnc = incomingKey
          ? encryptValue(incomingKey)
          : ensureEncrypted(existingKey);

        upsertConfig.run({
          id: config.id,
          name: config.name,
          baseUrl: config.baseUrl,
          model: config.model,
          apiKeyEnc,
          systemPrompt: config.systemPrompt || '',
          temperature: config.temperature ?? null,
          maxTokens: config.maxTokens ?? null,
          path: config.path || '/chat/completions',
          headerName: config.headerName || 'Authorization',
          headerPrefix: config.headerPrefix ?? 'Bearer ',
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    saveConfigs(configs);

    const activeConfigId = typeof payload?.activeConfigId === 'string'
      ? payload.activeConfigId
      : '';

    db.prepare(`
      INSERT INTO app_setting (key, value)
      VALUES ('activeConfigId', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(activeConfigId);

    return {
      configs,
      activeConfigId,
    };
  }
}

export default new AiConfigService();
