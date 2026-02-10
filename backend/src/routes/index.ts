import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { transactionRoutes } from '../modules/transactions/transaction.routes';
import { accountRoutes } from '../modules/accounts/account.routes';
import { goalRoutes } from '../modules/goals/goal.routes';
import { loanRoutes } from '../modules/loans/loan.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { bookingRoutes } from '../modules/bookings/booking.routes';
import { advisorRoutes } from '../modules/advisors/advisor.routes';
import { sessionRoutes } from '../modules/sessions/session.routes';
import { paymentRoutes } from '../modules/payments/payment.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { notificationRoutes } from '../modules/notifications/notification.routes';

const router = Router();

// Authentication routes (public)
router.use('/auth', authRoutes);

// Protected API routes
router.use('/transactions', transactionRoutes);
router.use('/accounts', accountRoutes);
router.use('/goals', goalRoutes);
router.use('/loans', loanRoutes);
router.use('/settings', settingsRoutes);

// Advisor & Booking routes
router.use('/bookings', bookingRoutes);
router.use('/advisors', advisorRoutes);
router.use('/sessions', sessionRoutes);

// Payment routes (includes webhook)
router.use('/payments', paymentRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

// Admin routes (requires admin role)
router.use('/admin', adminRoutes);

export { router as apiRoutes };
