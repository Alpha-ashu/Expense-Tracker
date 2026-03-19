import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { logger } from '../../config/logger';
import { validateBillUpload } from '../../utils/uploadPolicy';
import { processImage } from '../../utils/imageProcessing';
import { scanReceiptWithGemini } from '../ai/ocr.engine';

type JsonMap = Record<string, unknown>;

const DEFAULT_OCR_ENDPOINT = 'http://127.0.0.1:8001/scan-receipt';

const getReceiptOcrEndpoint = () =>
  (process.env.RECEIPT_OCR_ENDPOINT || DEFAULT_OCR_ENDPOINT).replace(/\/+$/, '');

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

const parseDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value.trim();

  const ddMmYyyy = normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (ddMmYyyy) {
    const day = Number(ddMmYyyy[1]);
    const month = Number(ddMmYyyy[2]) - 1;
    let year = Number(ddMmYyyy[3]);
    if (year < 100) year += 2000;

    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return undefined;
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const normalizeOcrResponse = (raw: JsonMap) => {
  const total = parseNumber(raw.total)
    ?? parseNumber(raw.total_amount)
    ?? parseNumber(raw.amount)
    ?? parseNumber(raw.grand_total)
    ?? parseNumber(raw.food_total);

  const merchantName = firstString(
    raw.vendor,
    raw.merchant,
    raw.merchant_name,
    raw.store_name,
    raw.nm,
    raw.supplier,
  );

  const date = parseDate(raw.date)
    ?? parseDate(raw.purchase_date)
    ?? parseDate(raw.transaction_date);

  const currency = firstString(raw.currency, raw.currency_code) || 'INR';

  return {
    merchantName,
    amount: total,
    subtotal: parseNumber(raw.subtotal),
    taxAmount: parseNumber(raw.taxAmount),
    date,
    time: firstString(raw.time),
    currency,
    invoiceNumber: firstString(raw.invoiceNumber),
    items: Array.isArray(raw.items) ? raw.items : undefined,
    taxes: Array.isArray(raw.taxes) ? raw.taxes : undefined,
    paymentMethod: firstString(raw.paymentMethod),
    rawFields: raw,
  };
};

const extractJson = async (response: globalThis.Response): Promise<JsonMap> => {
  const text = await response.text();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as JsonMap;
    }
  } catch {
    // no-op
  }

  return {};
};

export const scanReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Receipt image file is required' });
    }

    const validated = await validateBillUpload(file);
    if (validated.kind !== 'image') {
      return res.status(400).json({ error: 'Cloud OCR supports image files only' });
    }

    const processed = await processImage(validated.buffer);
    let raw: JsonMap = {};
    let source = 'unknown';

    // Try Gemini OCR first if API key is present
    if (process.env.GOOGLE_API_KEY) {
      try {
        raw = await scanReceiptWithGemini(processed.buffer, processed.contentType);
        source = 'gemini-1.5-flash';
        logger.info('Receipt scan successful via Gemini', { userId, source });
      } catch (geminiError) {
        logger.warn('Gemini OCR fallback triggered', { userId, error: geminiError });
      }
    }

    // Fallback to legacy OCR if Gemini failed or key missing
    if (source === 'unknown') {
      const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.contentType });
      const formData = new FormData();
      formData.append('file', blob, `receipt.${processed.extension}`);

      const endpoint = getReceiptOcrEndpoint();
      const timeout = Number(process.env.RECEIPT_OCR_TIMEOUT_MS || 30000);
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      const headers: HeadersInit = {};
      if (process.env.RECEIPT_OCR_API_KEY) {
        headers['x-api-key'] = process.env.RECEIPT_OCR_API_KEY;
      }

      const upstream = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutHandle));

      if (upstream.ok) {
        raw = await extractJson(upstream);
        source = 'cloud-donut';
      } else {
        const errorBody = await extractJson(upstream);
        logger.warn('Receipt OCR upstream failed', {
          userId,
          status: upstream.status,
          error: errorBody,
        });

        if (!process.env.GOOGLE_API_KEY) {
          return res.status(502).json({
            error: 'Cloud OCR service failed and no Gemini fallback available',
            details: errorBody,
          });
        }
      }
    }

    if (source === 'unknown') {
      return res.status(500).json({ error: 'Failed to process receipt with any available model' });
    }

    const normalized = normalizeOcrResponse(raw);

    return res.json({
      ...normalized,
      source,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.85,
      requiresConfirmation: true,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Cloud OCR timeout' });
    }

    logger.error('Receipt cloud scan failed', {
      error: error?.message || error,
    });

    return res.status(500).json({ error: 'Failed to scan receipt' });
  }
};
