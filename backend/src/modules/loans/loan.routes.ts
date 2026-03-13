import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { responseCache } from '../../middleware/cache';
import { CACHE_TTL_SECONDS } from '../../cache/cache-policy';
import * as LoanController from './loan.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', responseCache({ prefix: 'loans:list', ttlSeconds: CACHE_TTL_SECONDS.loans.list }), LoanController.getLoans);
router.post('/', LoanController.createLoan);
router.get('/:id', responseCache({ prefix: 'loans:item', ttlSeconds: CACHE_TTL_SECONDS.loans.item }), LoanController.getLoan);
router.put('/:id', LoanController.updateLoan);
router.delete('/:id', LoanController.deleteLoan);
router.post('/:id/payment', LoanController.addLoanPayment);

export { router as loanRoutes };
