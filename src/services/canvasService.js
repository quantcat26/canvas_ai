import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class CanvasService {
  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    this.dataFile = path.join(dataDir, 'canvases.json');
  }

  async ensureDataFile() {
    const dir = path.dirname(this.dataFile);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.dataFile);
    } catch {
      const initial = {};
      await fs.writeFile(this.dataFile, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  async loadAll() {
    await this.ensureDataFile();
    const raw = await fs.readFile(this.dataFile, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      return parsed || {};
    } catch (error) {
      console.error('Failed to parse canvas data file, reset to empty object.', error);
      return {};
    }
  }

  async saveAll(data) {
    await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  async list() {
    const data = await this.loadAll();
    return Object.values(data).map((record) => ({
      id: record.id,
      name: record.name,
      updatedAt: record.updatedAt,
      cardCount: Object.keys(record.state.cards || {}).length,
      connectionCount: Object.keys(record.state.connections || {}).length,
    }));
  }

  async get(canvasId) {
    const data = await this.loadAll();
    return data[canvasId] || null;
  }

  async create(name = 'Untitled Canvas', state) {
    const data = await this.loadAll();
    const id = uuidv4();
    const now = new Date().toISOString();
    const emptyState = state || {
      panX: 0,
      panY: 0,
      zoom: 1,
      cards: {},
      connections: {},
    };

    const record = {
      id,
      name,
      updatedAt: now,
      state: emptyState,
    };

    data[id] = record;
    await this.saveAll(data);
    return record;
  }

  async upsert(canvasId, payload) {
    const data = await this.loadAll();
    const now = new Date().toISOString();
    const existing = data[canvasId];

    const record = {
      id: canvasId,
      name: payload.name || existing?.name || 'Untitled Canvas',
      updatedAt: now,
      state: payload.state,
    };

    data[canvasId] = record;
    await this.saveAll(data);
    return record;
  }
}

export default new CanvasService();
