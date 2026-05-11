import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

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
  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    this.dataFile = path.join(dataDir, 'ai-configs.json');
  }

  async ensureDataFile() {
    const dir = path.dirname(this.dataFile);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.dataFile);
    } catch {
      const initial = { configs: [], activeConfigId: '' };
      await fs.writeFile(this.dataFile, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  async load() {
    await this.ensureDataFile();
    const raw = await fs.readFile(this.dataFile, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      const configs = Array.isArray(parsed?.configs) ? parsed.configs : [];
      const decryptedConfigs = configs.map((config) => {
        if (!config || typeof config !== 'object') return config;
        try {
          return {
            ...config,
            apiKey: decryptValue(config.apiKey || ''),
          };
        } catch (error) {
          console.warn('Failed to decrypt AI settings. Please re-enter the API key.', error);
          return {
            ...config,
            apiKey: '',
          };
        }
      });

      return {
        configs: decryptedConfigs,
        activeConfigId: typeof parsed?.activeConfigId === 'string' ? parsed.activeConfigId : '',
      };
    } catch (error) {
      console.error('Failed to parse the AI settings file; resetting to empty.', error);
      return { configs: [], activeConfigId: '' };
    }
  }

  async save(payload) {
    await this.ensureDataFile();
    const configs = Array.isArray(payload?.configs) ? payload.configs : [];
    let existingApiKeyById = new Map();

    try {
      const raw = await fs.readFile(this.dataFile, 'utf-8');
      const parsed = JSON.parse(raw);
      const existingConfigs = Array.isArray(parsed?.configs) ? parsed.configs : [];
      existingApiKeyById = new Map(
        existingConfigs
          .filter((config) => config && typeof config === 'object' && typeof config.id === 'string')
          .map((config) => [config.id, config.apiKey || '']),
      );
    } catch (error) {
      console.warn('Failed to read existing AI settings; the save will overwrite them.', error);
    }

    const encryptedConfigs = configs.map((config) => {
      if (!config || typeof config !== 'object') return config;
      const incomingKey = typeof config.apiKey === 'string' ? config.apiKey : '';
      const existingKey = typeof config.id === 'string'
        ? (existingApiKeyById.get(config.id) || '')
        : '';

      return {
        ...config,
        apiKey: incomingKey ? encryptValue(incomingKey) : ensureEncrypted(existingKey),
      };
    });

    const next = {
      configs: encryptedConfigs,
      activeConfigId: typeof payload?.activeConfigId === 'string' ? payload.activeConfigId : '',
    };
    await fs.writeFile(this.dataFile, JSON.stringify(next, null, 2), 'utf-8');
    return {
      configs,
      activeConfigId: next.activeConfigId,
    };
  }
}

export default new AiConfigService();
