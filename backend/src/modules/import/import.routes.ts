import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import { uploadImport, confirmImport, getImportSession } from './import.controller';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const confirmImportSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
    overrides: z.record(z.object({
      category: z.string().optional(),
      subcategory: z.string().optional(),
      amount: z.number().optional(),
      description: z.string().optional(),
    })).optional(),
  }),
});

/**
 * POST /api/v1/import/upload  - Upload CSV/Excel file and get preview
 * POST /api/v1/import/confirm - Confirm and save imported transactions
 * GET  /api/v1/import/:sessionId - Get session preview
 */
router.post('/upload', authenticate, upload.single('file'), uploadImport);
router.post('/confirm', authenticate, validate(confirmImportSchema), confirmImport);
router.get('/:sessionId', authenticate, getImportSession);

export default router;

