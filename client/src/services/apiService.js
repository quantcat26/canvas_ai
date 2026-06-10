import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiService {
  static async sendChatMessage(message, configId, attachments = []) {
    try {
      const response = await axios.post(`${API_BASE_URL}/ai/chat`, {
        message,
        configId,
        attachments,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
    }
  }

  static async listCanvases() {
    const response = await axios.get(`${API_BASE_URL}/canvas`);
    return response.data;
  }

  static async getCanvas(canvasId) {
    const response = await axios.get(`${API_BASE_URL}/canvas/${canvasId}`);
    return response.data;
  }

  static async createCanvas(name, id) {
    const response = await axios.post(`${API_BASE_URL}/canvas`, { name, id });
    return response.data;
  }

  static async saveCanvas(canvasId, name, state) {
    const response = await axios.put(`${API_BASE_URL}/canvas/${canvasId}`, { name, state });
    return response.data;
  }

  static async getAiConfigs() {
    const response = await axios.get(`${API_BASE_URL}/ai/configs`);
    return response.data;
  }

  static async saveAiConfigs(payload) {
    const response = await axios.put(`${API_BASE_URL}/ai/configs`, payload);
    return response.data;
  }

  static async getProjectTree() {
    const response = await axios.get(`${API_BASE_URL}/project/tree`);
    return response.data;
  }

  static async createProject(name, folderId) {
    const response = await axios.post(`${API_BASE_URL}/project/project`, { name, folderId });
    return response.data;
  }

  static async updateProject(id, payload) {
    const response = await axios.put(`${API_BASE_URL}/project/project/${id}`, payload);
    return response.data;
  }

  static async deleteProject(id) {
    const response = await axios.delete(`${API_BASE_URL}/project/project/${id}`);
    return response.data;
  }

  static async createFolder(name, parentFolderId) {
    const response = await axios.post(`${API_BASE_URL}/project/folder`, { name, parentFolderId });
    return response.data;
  }

  static async updateFolder(id, payload) {
    const response = await axios.put(`${API_BASE_URL}/project/folder/${id}`, payload);
    return response.data;
  }

  static async deleteFolder(id) {
    const response = await axios.delete(`${API_BASE_URL}/project/folder/${id}`);
    return response.data;
  }
}

export default ApiService;
