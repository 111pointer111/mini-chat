import express from 'express';
import { chat, chatStream, getChatHistory, getConversations, createConversation, updateConversation, deleteConversation } from '../controllers/aiChatController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.post('/', chat);
router.post('/stream', chatStream);
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.put('/conversations/:conversationId', updateConversation);
router.delete('/conversations/:conversationId', deleteConversation);
router.get('/history', getChatHistory);
router.get('/history/:conversationId', getChatHistory);

export default router;
