import express from 'express';
import { chat } from '../controllers/aiChatController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', chat);

export default router;
