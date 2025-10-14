import express from 'express';
import UserController from '../controllers/user/UserController.js';
import { 
  validateUserRegistration, 
  validateUserLogin, 
  validateOTP 
} from '../middleware/validation.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateUserRegistration, UserController.register);
router.post('/login', authLimiter, validateUserLogin, UserController.login);
router.post('/verify-otp', otpLimiter, validateOTP, UserController.verifyOTP);
router.post('/resend-otp', otpLimiter, UserController.resendOTP);
router.post('/refresh-token', UserController.refreshToken);

// Protected routes
router.post('/logout', authenticateToken, UserController.logout);

export default router;
