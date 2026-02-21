import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile, debugAuth } from './auth.controller';

const router = Router();

// Debug endpoint
router.get('/debug', debugAuth);

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);

export { router as authRoutes };

