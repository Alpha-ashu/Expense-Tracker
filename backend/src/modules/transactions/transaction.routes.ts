import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as TransactionController from './transaction.controller';

const router = Router();

// All transaction routes require authentication
router.use(authMiddleware);

router.get('/', TransactionController.getTransactions);
router.post('/', TransactionController.createTransaction);
router.get('/:id', TransactionController.getTransaction);
router.put('/:id', TransactionController.updateTransaction);
router.delete('/:id', TransactionController.deleteTransaction);
router.get('/account/:accountId', TransactionController.getAccountTransactions);

export { router as transactionRoutes };
