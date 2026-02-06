import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as LoanController from './loan.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', LoanController.getLoans);
router.post('/', LoanController.createLoan);
router.get('/:id', LoanController.getLoan);
router.put('/:id', LoanController.updateLoan);
router.delete('/:id', LoanController.deleteLoan);
router.post('/:id/payment', LoanController.addLoanPayment);

export { router as loanRoutes };
