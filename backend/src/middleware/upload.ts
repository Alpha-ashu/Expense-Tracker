import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../utils/uploadPolicy';

export const uploadSingle = (
  fieldName: string,
  options?: { maxBytes?: number },
) =>
  (req: Request, res: Response, next: NextFunction) => {
    const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes },
    });

    upload.single(fieldName)(req, res, (err: any) => {
      if (!err) {
        return next();
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit` });
      }

      return res.status(400).json({ error: err.message || 'Upload failed' });
    });
  };
