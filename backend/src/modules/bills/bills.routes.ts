import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';
import { uploadSingle } from '../../middleware/upload';
import * as BillsController from './bills.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', BillsController.getBills);
router.post(
  '/',
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.UPLOAD_RATE_LIMIT || 15),
    keyGenerator: (req) => (req as any).userId || req.headers['x-forwarded-for']?.toString() || req.ip,
  }),
  uploadSingle('file'),
  BillsController.uploadBill,
);
router.delete('/:id', BillsController.deleteBill);

export { router as billsRoutes };
