import express from 'express';
import { searchUsers } from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/search', protect, searchUsers);

export default router;
