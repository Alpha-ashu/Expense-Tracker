import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile, debugAuth, testSimple } from './auth.controller';

const router = Router();

// Test endpoints
router.get('/test-simple', testSimple);
router.get('/debug', debugAuth);

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);

export { router as authRoutes };

