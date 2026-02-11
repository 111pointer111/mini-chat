"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const friendController_1 = require("../controllers/friendController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.get('/', authMiddleware_1.protect, friendController_1.getFriends);
router.post('/request', authMiddleware_1.protect, friendController_1.sendFriendRequest);
router.get('/requests/pending', authMiddleware_1.protect, friendController_1.getPendingRequests);
router.put('/request/:requestId/accept', authMiddleware_1.protect, friendController_1.acceptFriendRequest);
exports.default = router;
