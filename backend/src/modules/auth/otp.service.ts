import { randomInt, randomUUID } from 'crypto';
import { prisma } from '../../db/prisma';
import { audit } from '../../utils/auditLogger';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESENDS_BEFORE_RESTRICT = 3;

interface OtpResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
}

/**
 * Generate a 6-digit OTP for a user, invalidating any previous active codes.
 */
export async function generateOtp(userId: string): Promise<OtpResult> {
  // Count recent OTPs (last 15 min) for rate limiting
  const recentCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const recentCount = await prisma.otpCode.count({
    where: { userId, createdAt: { gte: recentCutoff } },
  });

  if (recentCount >= MAX_RESENDS_BEFORE_RESTRICT) {
    // Mark user as limited_access after too many resends
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'limited_access' },
    });
    audit({ event: 'otp.rate_limited', userId, meta: { recentCount } });
    return { success: false, message: 'Too many OTP requests. Account restricted.' };
  }

  // Invalidate any existing unused OTPs for this user
  await prisma.otpCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.otpCode.create({
    data: {
      id: randomUUID(),
      userId,
      code,
      expiresAt,
    },
  });

  audit({ event: 'otp.generated', userId, meta: { expiresAt: expiresAt.toISOString() } });

  // In production, send via SMS/email here.
  // For now, return the code in the response (dev mode).
  return { success: true, message: 'OTP generated', expiresAt };
}

/**
 * Verify an OTP code for a user.
 */
export async function verifyOtp(userId: string, inputCode: string): Promise<OtpResult> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    return { success: false, message: 'No active OTP found. Please request a new one.' };
  }

  if (otp.expiresAt < new Date()) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    audit({ event: 'otp.expired', userId });
    return { success: false, message: 'OTP expired. Please request a new one.' };
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    audit({ event: 'otp.max_attempts', userId });
    return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  if (otp.code !== inputCode) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: otp.attempts + 1 },
    });
    audit({ event: 'otp.invalid', userId, meta: { attempts: otp.attempts + 1 } });
    return { success: false, message: 'Invalid OTP code.' };
  }

  // OTP is valid  mark used
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { used: true },
  });

  audit({ event: 'otp.verified', userId });
  return { success: true, message: 'OTP verified successfully.' };
}
