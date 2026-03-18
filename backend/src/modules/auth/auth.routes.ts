import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile, updateProfile } from './auth.controller';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// Strict rate limiting on auth endpoints — prevents brute-force attacks
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

export { router as authRoutes };

