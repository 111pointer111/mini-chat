import express from 'express';
import {
    getProviders,
    getUserProvider,
    setUserProvider,
    createProvider,
    updateProvider,
    deleteProvider,
    getAllProviders,
} from '../controllers/aiProviderController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

// User routes
router.get('/', getProviders);
router.get('/user', getUserProvider);
router.put('/user', setUserProvider);

// Admin routes
router.get('/admin', adminOnly, getAllProviders);
router.post('/admin', adminOnly, createProvider);
router.put('/admin/:id', adminOnly, updateProvider);
router.delete('/admin/:id', adminOnly, deleteProvider);

export default router;
