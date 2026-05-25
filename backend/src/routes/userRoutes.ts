import express from 'express';
import { searchUsers, updateMe } from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.patch('/me', protect, updateMe);
router.get('/search', protect, searchUsers);

export default router;
