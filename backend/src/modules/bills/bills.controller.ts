import { Response } from 'express';
import crypto from 'crypto';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';
import { validateUpload, makeStoragePath } from '../../utils/uploadPolicy';
import { processImage } from '../../utils/imageProcessing';
import { scanBufferForViruses } from '../../utils/virusScan';
import { moderateImage } from '../../utils/moderation';
import { createSignedUrl, uploadBuffer, removeObject } from '../../utils/storage';

const hashBuffer = (buffer: Buffer) =>
  crypto.createHash('sha256').update(buffer).digest('hex');

export const getBills = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const transactionId = req.query.transactionId ? String(req.query.transactionId) : undefined;

    const bills = await prisma.expenseBill.findMany({
      where: {
        userId,
        ...(transactionId ? { transactionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const withUrls = await Promise.all(
      bills.map(async (bill) => {
        let signedUrl: string | null = null;
        try {
          signedUrl = await createSignedUrl(bill.storagePath);
        } catch (error: any) {
          logger.warn('Failed to create signed url', { billId: bill.id, error: error?.message || error });
        }

        return {
          id: bill.id,
          transactionId: bill.transactionId,
          fileName: bill.originalName,
          fileType: bill.contentType,
          fileSize: bill.size,
          uploadedAt: bill.createdAt,
          downloadUrl: signedUrl,
        };
      }),
    );

    res.json(withUrls);
  } catch (error: any) {
    logger.error('Failed to fetch bills', { error: error?.message || error });
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
};

export const uploadBill = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const transactionId = req.body.transactionId ? String(req.body.transactionId).trim() : undefined;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const validated = await validateUpload(file);
    let buffer = validated.buffer;
    let contentType = validated.contentType;
    let extension = validated.extension;

    let moderationStatus = 'skipped';
    if (validated.kind === 'image') {
      const processed = await processImage(buffer);
      buffer = processed.buffer;
      contentType = processed.contentType;
      extension = processed.extension;

      const moderation = await moderateImage(buffer, contentType);
      moderationStatus = moderation.status;
      if (moderation.status === 'rejected') {
        return res.status(400).json({ error: 'Image rejected by moderation', details: moderation.details });
      }
    }

    const scanResult = await scanBufferForViruses(buffer);
    if (scanResult.status === 'infected') {
      return res.status(400).json({ error: 'File failed virus scan', details: scanResult.details });
    }

    const baseName = validated.originalName.replace(/\.[^/.]+$/, '');
    const displayName = `${baseName}.${extension}`;
    const storagePath = makeStoragePath(userId, extension, transactionId);
    await uploadBuffer(storagePath, buffer, contentType);

    const bill = await prisma.expenseBill.create({
      data: {
        userId,
        transactionId,
        originalName: displayName,
        contentType,
        size: buffer.length,
        storagePath,
        sha256: hashBuffer(buffer),
        scanStatus: scanResult.status,
        scanResult: scanResult.details,
        moderationStatus,
      },
    });

    logger.info('Upload completed', {
      userId,
      billId: bill.id,
      storagePath,
      contentType,
      size: buffer.length,
      scanStatus: scanResult.status,
    });

    let downloadUrl: string | null = null;
    try {
      downloadUrl = await createSignedUrl(storagePath);
    } catch (error: any) {
      logger.warn('Signed url creation failed after upload', { billId: bill.id, error: error?.message || error });
    }

    return res.status(201).json({
      id: bill.id,
      transactionId: bill.transactionId,
      fileName: bill.originalName,
      fileType: bill.contentType,
      fileSize: bill.size,
      uploadedAt: bill.createdAt,
      downloadUrl,
    });
  } catch (error: any) {
    logger.error('Upload failed', { error: error?.message || error });
    return res.status(500).json({ error: error?.message || 'Upload failed' });
  }
};

export const deleteBill = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const bill = await prisma.expenseBill.findUnique({
      where: { id },
    });

    if (!bill || bill.userId !== userId) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    try {
      await removeObject(bill.storagePath);
    } catch (error: any) {
      logger.warn('Failed to remove object from storage', { billId: bill.id, error: error?.message || error });
    }

    await prisma.expenseBill.delete({ where: { id } });

    return res.json({ message: 'Bill deleted' });
  } catch (error: any) {
    logger.error('Failed to delete bill', { error: error?.message || error });
    return res.status(500).json({ error: 'Failed to delete bill' });
  }
};
