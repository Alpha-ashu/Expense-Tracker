import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as SessionController from './session.controller';

const router = Router();

// All session routes require authentication
router.use(authMiddleware);

// Get session details
router.get('/:id', SessionController.getSession);

// Chat messages
router.post('/:id/messages', SessionController.sendMessage);
router.get('/:id/messages', SessionController.getMessages);

// Session control (advisor)
router.post('/:id/start', SessionController.startSession);
router.post('/:id/complete', SessionController.completeSession);

// Cancel session (both advisor and client)
router.post('/:id/cancel', SessionController.cancelSession);

export { router as sessionRoutes };
