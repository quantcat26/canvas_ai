import projectService from '../services/projectService.js';
import { sendApiError } from '../utils/apiResponse.js';

const isObjectRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

class ProjectController {
  async getTree(req, res) {
    try {
      const tree = await projectService.getTree();
      res.json(tree);
    } catch (error) {
      console.error('Failed to get project tree:', error);
      sendApiError(res, 500, 'PROJECT_TREE_FAILED', 'Unable to retrieve the project tree.');
    }
  }

  async createProject(req, res) {
    try {
      const body = isObjectRecord(req.body) ? req.body : {};
      const name = typeof body.name === 'string' ? body.name : undefined;
      const folderId = typeof body.folderId === 'string' ? body.folderId : undefined;
      const project = await projectService.create(name, folderId);
      res.status(201).json(project);
    } catch (error) {
      console.error('Failed to create project:', error);
      sendApiError(res, 500, 'PROJECT_CREATE_FAILED', 'Unable to create the project.');
    }
  }

  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const body = isObjectRecord(req.body) ? req.body : {};
      const result = await projectService.update(id, body);
      if (!result) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'Project not found.');
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Failed to update project:', error);
      sendApiError(res, 500, 'PROJECT_UPDATE_FAILED', 'Unable to update the project.');
    }
  }

  async deleteProject(req, res) {
    try {
      const { id } = req.params;
      const deleted = await projectService.delete(id);
      if (!deleted) {
        sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'Project not found.');
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete project:', error);
      sendApiError(res, 500, 'PROJECT_DELETE_FAILED', 'Unable to delete the project.');
    }
  }

  async createFolder(req, res) {
    try {
      const body = isObjectRecord(req.body) ? req.body : {};
      const name = typeof body.name === 'string' ? body.name : undefined;
      const parentFolderId = typeof body.parentFolderId === 'string' ? body.parentFolderId : undefined;
      const folder = await projectService.createFolder(name, parentFolderId);
      res.status(201).json(folder);
    } catch (error) {
      console.error('Failed to create folder:', error);
      sendApiError(res, 500, 'FOLDER_CREATE_FAILED', 'Unable to create the folder.');
    }
  }

  async updateFolder(req, res) {
    try {
      const { id } = req.params;
      const body = isObjectRecord(req.body) ? req.body : {};
      const result = await projectService.updateFolder(id, body);
      if (!result) {
        sendApiError(res, 404, 'FOLDER_NOT_FOUND', 'Folder not found.');
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('Failed to update folder:', error);
      sendApiError(res, 500, 'FOLDER_UPDATE_FAILED', 'Unable to update the folder.');
    }
  }

  async deleteFolder(req, res) {
    try {
      const { id } = req.params;
      const deleted = await projectService.deleteFolder(id);
      if (!deleted) {
        sendApiError(res, 404, 'FOLDER_NOT_FOUND', 'Folder not found.');
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete folder:', error);
      sendApiError(res, 500, 'FOLDER_DELETE_FAILED', 'Unable to delete the folder.');
    }
  }
}

export default new ProjectController();
