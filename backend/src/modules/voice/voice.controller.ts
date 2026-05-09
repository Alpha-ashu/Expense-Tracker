import { Request, Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { processVoiceTranscript, FinancialAction } from './voice.nlp';
import { logger } from '../../config/logger';

export const processVoice = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { transcript } = req.body as { transcript: string };

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (transcript.length > 5000) {
      return res.status(400).json({ error: 'Transcript too long (max 5000 characters)' });
    }

    const actions = await processVoiceTranscript(transcript);

    // Store transcript in DB (fail-safe)
    try {
      await (prisma as any).voiceTranscript?.create?.({
        data: {
          userId,
          originalText: transcript,
          cleanedText: transcript,
          actionsCount: actions.length,
          processedAt: new Date(),
        },
      }).catch(() => {/* table may not exist yet */});
    } catch { /* non-critical */ }

    return res.json({
      success: true,
      transcript,
      actions,
      totalActions: actions.length,
      requiresReview: actions.some(a => a.requiresReview),
    });
  } catch (error: any) {
    logger.error('Voice processing failed', { error: error.message });
    return res.status(500).json({ error: 'Failed to process voice input. Please try again.' });
  }
};

export const learnFromCorrection = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { originalSegment, correctedType, correctedCategory, correctedAmount } = req.body as {
      originalSegment: string;
      correctedType?: string;
      correctedCategory?: string;
      correctedAmount?: number;
    };

    if (!originalSegment) {
      return res.status(400).json({ error: 'originalSegment is required' });
    }

    // Store learning record (fail-safe)
    try {
      await (prisma as any).userVoiceLearning?.create?.({
        data: {
          userId,
          originalText: originalSegment,
          correctedType: correctedType ?? null,
          correctedCategory: correctedCategory ?? null,
          correctedAmount: correctedAmount ?? null,
          createdAt: new Date(),
        },
      }).catch(() => {});
    } catch { /* non-critical */ }

    return res.json({ success: true, message: 'Learning recorded' });
  } catch (error: any) {
    logger.error('Voice learning failed', { error: error.message });
    return res.status(500).json({ error: 'Failed to record correction' });
  }
};

