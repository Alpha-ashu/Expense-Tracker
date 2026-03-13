import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { responseCache } from '../../middleware/cache';
import { CACHE_TTL_SECONDS } from '../../cache/cache-policy';
import * as GoalController from './goal.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', responseCache({ prefix: 'goals:list', ttlSeconds: CACHE_TTL_SECONDS.goals.list }), GoalController.getGoals);
router.post('/', GoalController.createGoal);
router.get('/:id', responseCache({ prefix: 'goals:item', ttlSeconds: CACHE_TTL_SECONDS.goals.item }), GoalController.getGoal);
router.put('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export { router as goalRoutes };
