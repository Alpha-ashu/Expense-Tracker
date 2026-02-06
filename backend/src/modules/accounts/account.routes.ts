import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as AccountController from './account.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', AccountController.getAccounts);
router.post('/', AccountController.createAccount);
router.get('/:id', AccountController.getAccount);
router.put('/:id', AccountController.updateAccount);
router.delete('/:id', AccountController.deleteAccount);

export { router as accountRoutes };
