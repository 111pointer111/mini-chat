import express from 'express';
import { register, login, getMe, sendSmsCode, registerByPhone, loginByPhone, loginByEmailCode, bindPhone, resetPasswordByPhone, sendVerificationEmail, verifyEmail } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Phone authentication routes
router.post('/send-code', sendSmsCode);
router.post('/register-phone', registerByPhone);
router.post('/login-phone', loginByPhone);
router.post('/bind-phone', protect, bindPhone);
router.post('/reset-password-phone', resetPasswordByPhone);

// Email verification routes
router.post('/send-verification', sendVerificationEmail);
router.post('/verify-email', verifyEmail);
router.post('/login-email-code', loginByEmailCode);

export default router;
