import express from 'express';
import { sendFriendRequest, acceptFriendRequest, getFriends, getPendingRequests } from '../controllers/friendController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getFriends);
router.post('/request', protect, sendFriendRequest);
router.get('/requests/pending', protect, getPendingRequests);
router.put('/request/:requestId/accept', protect, acceptFriendRequest);

export default router;
