import express from 'express';
import canvasController from '../controllers/canvasController.js';

const router = express.Router();

router.get('/', canvasController.list);
router.get('/:id', canvasController.get);
router.post('/', canvasController.create);
router.put('/:id', canvasController.save);

export default router;
