import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as AdminController from './admin.controller';

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// User management
router.get('/users', AdminController.getAllUsers);
router.get('/users/pending', AdminController.getPendingAdvisors);
router.post('/users/:advisorId/approve', AdminController.approveAdvisor);
router.post('/users/:advisorId/reject', AdminController.rejectAdvisor);

// Statistics
router.get('/stats', AdminController.getPlatformStats);

// Feature flags
router.get('/features', AdminController.getFeatureFlags);
router.post('/features/toggle', AdminController.toggleFeatureFlag);

// Reports
router.get('/reports/users', AdminController.getUsersReport);
router.get('/reports/revenue', AdminController.getRevenueReport);

export { router as adminRoutes };
