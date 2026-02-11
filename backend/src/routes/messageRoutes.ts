import express from 'express';
import { getMessages } from '../controllers/messageController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/:userId', protect, getMessages);

export default router;
