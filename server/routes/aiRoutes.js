import express from 'express';
import aiController from '../controllers/aiController.js';

const router = express.Router();

router.post('/chat', aiController.chat);
router.get('/services', aiController.getAvailableServices);
router.get('/configs', aiController.getConfigs);
router.put('/configs', aiController.saveConfigs);

export default router;
