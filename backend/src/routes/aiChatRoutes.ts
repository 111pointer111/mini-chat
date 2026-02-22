import express from 'express';
import { chat, getChatHistory } from '../controllers/aiChatController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', chat);
router.get('/history', getChatHistory);

export default router;
