import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as GoalController from './goal.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', GoalController.getGoals);
router.post('/', GoalController.createGoal);
router.get('/:id', GoalController.getGoal);
router.put('/:id', GoalController.updateGoal);
router.delete('/:id', GoalController.deleteGoal);

export { router as goalRoutes };
