import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as NotificationController from './notification.controller';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

// Get user's notifications
router.get('/', NotificationController.getNotifications);

// Get unread count
router.get('/unread/count', NotificationController.getUnreadCount);

// Get specific notification
router.get('/:id', NotificationController.getNotification);

// Mark as read
router.put('/:id/read', NotificationController.markAsRead);

// Mark all as read
router.post('/mark-all-read', NotificationController.markAllAsRead);

// Delete notification
router.delete('/:id', NotificationController.deleteNotification);

// Clear all
router.delete('/', NotificationController.clearAllNotifications);

// Send notification (admin/system only)
router.post('/send', requireRole('admin'), NotificationController.sendNotification);

export { router as notificationRoutes };
