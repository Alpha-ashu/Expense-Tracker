import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile } from './auth.controller';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// Strict rate limiting on auth endpoints — prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window per IP
  keyGenerator: (req) => req.ip || 'unknown',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/profile', authMiddleware, getProfile);

export { router as authRoutes };

