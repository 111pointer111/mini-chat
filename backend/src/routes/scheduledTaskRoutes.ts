import express from 'express';
import {
    getScheduledTasks,
    updateScheduledTask,
    createCustomTask,
    updateCustomTask,
    deleteCustomTask,
    getTaskMessages,
    getConversations,
} from '../controllers/scheduledTaskController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get all scheduled tasks for current user
router.get('/', getScheduledTasks);

// Get all conversations
router.get('/conversations', getConversations);

// Custom task routes (must be before /:taskType to avoid conflicts)
router.post('/custom', createCustomTask);
router.put('/custom/:taskId', updateCustomTask);
router.delete('/custom/:taskId', deleteCustomTask);

// Preset task routes
router.put('/:taskType', updateScheduledTask);

// Get messages for a scheduled task
router.get('/:taskType/messages', getTaskMessages);

export default router;
