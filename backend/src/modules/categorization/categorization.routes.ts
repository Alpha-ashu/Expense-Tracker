import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as CategorizationController from './categorization.controller';

const router = Router();
const learnRouter = Router();

router.use(authMiddleware);
learnRouter.use(authMiddleware);

router.post('/', CategorizationController.categorize);
learnRouter.post('/', CategorizationController.learn);

export { router as categorizationRoutes, learnRouter };
