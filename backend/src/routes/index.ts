import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { transactionRoutes } from '../modules/transactions/transaction.routes';
import { accountRoutes } from '../modules/accounts/account.routes';
import { goalRoutes } from '../modules/goals/goal.routes';
import { loanRoutes } from '../modules/loans/loan.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';

const router = Router();

// Authentication routes (public)
router.use('/auth', authRoutes);

// Protected API routes
router.use('/transactions', transactionRoutes);
router.use('/accounts', accountRoutes);
router.use('/goals', goalRoutes);
router.use('/loans', loanRoutes);
router.use('/settings', settingsRoutes);

export { router as apiRoutes };
