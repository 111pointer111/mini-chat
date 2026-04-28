import express from 'express';
import {
    createServer,
    deleteServer,
    getServers,
    getTools,
    refreshServerTools,
    testServer,
    updateServer,
} from '../controllers/mcpController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/servers', getServers);
router.post('/servers', createServer);
router.put('/servers/:id', updateServer);
router.delete('/servers/:id', deleteServer);
router.post('/servers/:id/test', testServer);
router.post('/servers/:id/refresh-tools', refreshServerTools);
router.get('/tools', getTools);

export default router;
