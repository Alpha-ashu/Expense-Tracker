import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { processVoice, learnFromCorrection } from './voice.controller';

const router = Router();

const processVoiceSchema = z.object({
  body: z.object({
    transcript: z.string().min(1).max(5000),
  }),
});

const learnSchema = z.object({
  body: z.object({
    originalSegment: z.string().min(1),
    correctedType: z.string().optional(),
    correctedCategory: z.string().optional(),
    correctedAmount: z.number().optional(),
  }),
});

/**
 * POST /api/v1/voice/process
 * Analyze a voice transcript and extract financial actions
 */
router.post('/process', authenticate, validate(processVoiceSchema), processVoice);

/**
 * POST /api/v1/voice/learn
 * Record user corrections for improved future recognition
 */
router.post('/learn', authenticate, validate(learnSchema), learnFromCorrection);

export default router;

