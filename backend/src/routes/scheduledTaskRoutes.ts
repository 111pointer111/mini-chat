import express from 'express';
import {
    getScheduledTasks,
    updateScheduledTask,
    getTaskMessages,
    getConversations,
} from '../controllers/scheduledTaskController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all scheduled tasks for current user
router.get('/', getScheduledTasks);

// Update a scheduled task
router.put('/:taskType', updateScheduledTask);

// Get messages for a scheduled task
router.get('/:taskType/messages', getTaskMessages);

// Get all conversations
router.get('/conversations', getConversations);

export default router;
