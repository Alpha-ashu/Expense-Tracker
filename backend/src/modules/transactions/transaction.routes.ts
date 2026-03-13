import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import * as TransactionController from './transaction.controller';
import {
	transactionAccountParamSchema,
	transactionCreateSchema,
	transactionIdParamSchema,
	transactionQuerySchema,
	transactionUpdateSchema,
} from './transaction.validation';

const router = Router();

// All transaction routes require authentication
router.use(authMiddleware);

router.get('/', validateQuery(transactionQuerySchema), TransactionController.getTransactions);
router.post('/', validateBody(transactionCreateSchema), TransactionController.createTransaction);
router.get('/:id', validateParams(transactionIdParamSchema), TransactionController.getTransaction);
router.put(
	'/:id',
	validateParams(transactionIdParamSchema),
	validateBody(transactionUpdateSchema),
	TransactionController.updateTransaction
);
router.delete('/:id', validateParams(transactionIdParamSchema), TransactionController.deleteTransaction);
router.get(
	'/account/:accountId',
	validateParams(transactionAccountParamSchema),
	TransactionController.getAccountTransactions
);

export { router as transactionRoutes };
