import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { responseCache } from '../../middleware/cache';
import * as LoanController from './loan.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', responseCache({ prefix: 'loans:list', ttlSeconds: 60 }), LoanController.getLoans);
router.post('/', LoanController.createLoan);
router.get('/:id', responseCache({ prefix: 'loans:item', ttlSeconds: 60 }), LoanController.getLoan);
router.put('/:id', LoanController.updateLoan);
router.delete('/:id', LoanController.deleteLoan);
router.post('/:id/payment', LoanController.addLoanPayment);

export { router as loanRoutes };
