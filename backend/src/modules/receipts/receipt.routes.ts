import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { authenticatedRateLimit } from '../../middleware/rateLimit';
import { uploadSingle } from '../../middleware/upload';
import { validateQuery } from '../../middleware/validate';
import { BILL_MAX_UPLOAD_BYTES } from '../../utils/uploadPolicy';
import { scanReceipt } from './receipt.controller';
import { receiptScanQuerySchema } from './receipt.validation';

const router = Router();

router.use(authMiddleware);

router.post(
  '/scan',
  authenticatedRateLimit({
    windowMs: 60_000,
    max: Number(process.env.RECEIPT_SCAN_RATE_LIMIT || 8),
    scope: 'api-receipts-scan',
    message: 'Too many receipt scan requests. Please try again later.',
  }),
  validateQuery(receiptScanQuerySchema),
  uploadSingle('file', { maxBytes: BILL_MAX_UPLOAD_BYTES }),
  scanReceipt,
);

export { router as receiptRoutes };
