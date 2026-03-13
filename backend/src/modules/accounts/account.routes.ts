import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { responseCache } from '../../middleware/cache';
import * as AccountController from './account.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', responseCache({ prefix: 'accounts:list', ttlSeconds: 90 }), AccountController.getAccounts);
router.post('/', AccountController.createAccount);
router.get('/:id', responseCache({ prefix: 'accounts:item', ttlSeconds: 120 }), AccountController.getAccount);
router.put('/:id', AccountController.updateAccount);
router.delete('/:id', AccountController.deleteAccount);

export { router as accountRoutes };
