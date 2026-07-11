import express from 'express';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';

// Rate limiters for auth security
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 10 attempts per window
  message: { success: false, message: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 5 attempts per window
  message: { success: false, message: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

router.post('/verify-otp', strictLimiter, authController.verifyOTP);
router.post('/resend-otp', strictLimiter, authController.resendOTP);

router.post('/resend-signup-otp', strictLimiter, authController.resendSignUpOTP);
router.post('/verify-signup-otp', strictLimiter, authController.verifySignUpOTP);

router.post('/forgot-password', strictLimiter, authController.forgotPassword);
router.post('/reset-password', strictLimiter, authController.resetPassword);
router.post('/reset-password-via-token', strictLimiter, authController.resetPasswordViaToken);

router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.get('/roles', authController.getPublicRoles);
router.get('/my-permissions', authenticate, authController.getMyPermissions);
router.post('/change-password', authenticate, authController.changePassword);
router.delete('/delete-account', authenticate, authController.deleteAccount);

export default router;
