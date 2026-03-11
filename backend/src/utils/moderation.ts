import { logger } from '../config/logger';

export type ModerationStatus = 'approved' | 'rejected' | 'skipped' | 'failed';

export type ModerationResult = {
  status: ModerationStatus;
  details?: string;
};

export const moderateImage = async (buffer: Buffer, contentType: string): Promise<ModerationResult> => {
  const endpoint = process.env.MODERATION_WEBHOOK_URL;
  const required = process.env.MODERATION_REQUIRED === 'true';

  if (!endpoint) {
    return { status: 'skipped', details: 'MODERATION_WEBHOOK_URL not configured' };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Moderation': 'file-upload',
      },
      body: JSON.stringify({
        contentType,
        imageBase64: buffer.toString('base64'),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Moderation failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    if (payload?.allowed === false) {
      return { status: 'rejected', details: payload?.reason || 'Rejected by moderation service' };
    }

    return { status: 'approved', details: payload?.reason || 'Approved' };
  } catch (error: any) {
    logger.warn('Image moderation failed', { error: error?.message || error });
    if (required) {
      throw new Error('Moderation service unavailable');
    }
    return { status: 'failed', details: error?.message || 'Moderation failed' };
  }
};
