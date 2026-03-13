import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { responseCache } from '../../middleware/cache';
import * as GoalController from './goal.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', responseCache({ prefix: 'goals:list', ttlSeconds: 60 }), GoalController.getGoals);
router.post('/', GoalController.createGoal);
router.get('/:id', responseCache({ prefix: 'goals:item', ttlSeconds: 60 }), GoalController.getGoal);
router.put('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export { router as goalRoutes };
