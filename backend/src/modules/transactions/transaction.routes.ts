import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate';
import * as TransactionController from './transaction.controller';
import { responseCache } from '../../middleware/cache';
import {
	transactionAccountParamSchema,
	transactionCreateValidatedSchema,
	transactionIdParamSchema,
	transactionQuerySchema,
	transactionUpdateSchema,
} from './transaction.validation';

const router = Router();

// All transaction routes require authentication
router.use(authMiddleware);

router.get(
	'/',
	validateQuery(transactionQuerySchema),
	responseCache({ prefix: 'transactions:list', ttlSeconds: 60 }),
	TransactionController.getTransactions
);
router.post('/', validateBody(transactionCreateValidatedSchema), TransactionController.createTransaction);
router.get(
	'/:id',
	validateParams(transactionIdParamSchema),
	responseCache({ prefix: 'transactions:item', ttlSeconds: 60 }),
	TransactionController.getTransaction
);
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
	responseCache({ prefix: 'transactions:account', ttlSeconds: 45 }),
	TransactionController.getAccountTransactions
);

export { router as transactionRoutes };
