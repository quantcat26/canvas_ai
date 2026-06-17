import express from 'express';
import projectController from '../controllers/projectController.js';

const router = express.Router();

router.get('/tree', projectController.getTree);
router.post('/project', projectController.createProject);
router.put('/project/:id', projectController.updateProject);
router.delete('/project/:id', projectController.deleteProject);
router.post('/folder', projectController.createFolder);
router.put('/folder/:id', projectController.updateFolder);
router.delete('/folder/:id', projectController.deleteFolder);

export default router;
