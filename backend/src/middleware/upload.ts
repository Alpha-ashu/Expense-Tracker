import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../utils/uploadPolicy';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

export const uploadSingle = (fieldName: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (!err) {
        return next();
      }

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit` });
      }

      return res.status(400).json({ error: err.message || 'Upload failed' });
    });
  };
