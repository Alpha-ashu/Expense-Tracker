import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, getUserId } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { captureAIEvent } from './ai.controller';
import { aiEventBodySchema } from './ai.validation';
import { getAIQuotaInfo } from '../../utils/aiUsageTracker';

const router = Router();

router.use(authMiddleware);
router.post('/events', validateBody(aiEventBodySchema), captureAIEvent);

// Return the authenticated user's current AI usage quota
router.get('/quota', async (req: AuthRequest, res: Response) => {
  const info = await getAIQuotaInfo(getUserId(req));
  res.json(info);
});

export { router as aiRoutes };
