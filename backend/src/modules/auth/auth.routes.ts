import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { register, login, getProfile } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);

export { router as authRoutes };

