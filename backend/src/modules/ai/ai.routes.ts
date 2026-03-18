import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { captureAIEvent } from './ai.controller';
import { aiEventBodySchema } from './ai.validation';

const router = Router();

router.use(authMiddleware);
router.post('/events', validateBody(aiEventBodySchema), captureAIEvent);

export { router as aiRoutes };
