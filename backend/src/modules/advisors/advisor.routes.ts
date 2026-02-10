import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, requireApproved } from '../../middleware/rbac';
import * as AdvisorController from './advisor.controller';

const router = Router();

// Public routes (no auth needed)
router.get('/', AdvisorController.listAdvisors);
router.get('/:id', AdvisorController.getAdvisor);

// Protected routes (require authentication)
router.use(authMiddleware);

// Advisor-only routes
router.post(
  '/availability',
  requireRole('advisor'),
  requireApproved,
  AdvisorController.setAvailability
);

router.get(
  '/:id/availability',
  AdvisorController.getAvailability
);

router.delete(
  '/availability/:id',
  requireRole('advisor'),
  AdvisorController.deleteAvailability
);

router.get(
  '/me/sessions',
  requireRole('advisor'),
  AdvisorController.getSessions
);

// Client-only routes
router.put(
  '/sessions/:id/rate',
  AdvisorController.rateSession
);

export { router as advisorRoutes };
