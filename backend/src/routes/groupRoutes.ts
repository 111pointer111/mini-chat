import express from 'express';
import {
    addGroupMembers,
    createGroup,
    deleteGroupDocument,
    getGroupMembers,
    getGroupMessages,
    importGroupDocumentFromUrl,
    listGroupDocuments,
    listGroups,
    uploadGroupDocument,
} from '../controllers/groupController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.use(protect);

router.get('/', listGroups);
router.post('/', createGroup);
router.get('/:groupId/members', getGroupMembers);
router.post('/:groupId/members', addGroupMembers);
router.get('/:groupId/messages', getGroupMessages);
router.get('/:groupId/kb/documents', listGroupDocuments);
router.post('/:groupId/kb/documents/upload', uploadGroupDocument);
router.post('/:groupId/kb/documents/url', importGroupDocumentFromUrl);
router.delete('/:groupId/kb/documents/:documentId', deleteGroupDocument);

export default router;
