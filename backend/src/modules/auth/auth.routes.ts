import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile, updateProfile, sendOtp, verifyOtpEndpoint, getDevices, revokeDevice } from './auth.controller';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// Strict rate limiting on auth endpoints  prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: 60_000,          // 1 minute
  max: Number(process.env.AUTH_RATE_LIMIT || 5),
  scope: 'auth-route',
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (req) => req.ip || 'unknown',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

// OTP routes (authenticated  user must have valid JWT)
router.post('/otp/send', authMiddleware, sendOtp);
router.post('/otp/verify', authMiddleware, verifyOtpEndpoint);

// Device management routes
router.get('/devices', authMiddleware, getDevices);
router.delete('/devices/:deviceId', authMiddleware, revokeDevice);

export { router as authRoutes };

