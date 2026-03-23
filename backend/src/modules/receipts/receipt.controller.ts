import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { logger } from '../../config/logger';
import { validateBillUpload } from '../../utils/uploadPolicy';
import { processImage } from '../../utils/imageProcessing';
import { scanReceiptWithGemini } from '../ai/ocr.engine';
import { incrementAIUsage } from '../../utils/aiUsageTracker';
import { withCircuitBreaker } from '../../utils/circuitBreaker';
import { audit } from '../../utils/auditLogger';
import { prisma } from '../../db/prisma';
import { eventBus } from '../../utils/eventBus';

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
  // Priority: NETT/NET wins over generic 'amount' (which could be pre-tax subtotal)
  const total = parseNumber(raw.netAmount)
    ?? parseNumber(raw.nett)
    ?? parseNumber(raw.net)
    ?? parseNumber(raw.net_amount)
    ?? parseNumber(raw.nett_amount)
    ?? parseNumber(raw.amount_payable)
    ?? parseNumber(raw.total_payable)
    ?? parseNumber(raw.grand_total)
    ?? parseNumber(raw.total)
    ?? parseNumber(raw.total_amount)
    ?? parseNumber(raw.amount)
    ?? parseNumber(raw.food_total);

  const merchantName = firstString(
    raw.vendor,
    raw.merchant,
    raw.merchantName,
    raw.merchant_name,
    raw.store_name,
    raw.nm,
    raw.supplier,
  );

  const date = parseDate(raw.date)
    ?? parseDate(raw.purchase_date)
    ?? parseDate(raw.transaction_date);

  const currency = firstString(raw.currency, raw.currency_code) || 'INR';

  // --- Normalise tax breakdown (global: CGST/SGST/VAT/Sales Tax/etc.) ---
  const taxBreakdown = Array.isArray(raw.taxBreakdown)
    ? (raw.taxBreakdown as Array<{ name: string; rate?: number; amount: number }>)
        .filter((t) => t?.name && typeof t?.amount === 'number')
    : Array.isArray(raw.taxes)
      ? (raw.taxes as Array<{ name: string; rate?: number; amount: number }>)
      : undefined;

  const taxAmountRaw = parseNumber(raw.totalTaxAmount) ?? parseNumber(raw.taxAmount);
  const derivedTaxTotal = taxBreakdown && taxBreakdown.length > 0
    ? Number(taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0).toFixed(2))
    : undefined;
  const resolvedTaxAmount = taxAmountRaw ?? derivedTaxTotal;

  // --- Validate total ---
  const subtotal = parseNumber(raw.preTaxSubtotal) ?? parseNumber(raw.subtotal);
  let validationResult: { isValid: boolean; calculated: number; detected: number } | undefined;
  if (total !== undefined && resolvedTaxAmount !== undefined) {
    const itemsSum = Array.isArray(raw.items)
      ? (raw.items as Array<{ amount?: number }>).reduce((s, i) => s + (parseNumber(i?.amount) ?? 0), 0)
      : subtotal ?? (total - (resolvedTaxAmount ?? 0));
    const calculated = Number((itemsSum + (resolvedTaxAmount ?? 0)).toFixed(2));
    const detected = total;
    validationResult = {
      isValid: Math.abs(calculated - detected) < 2.0,
      calculated,
      detected,
    };
  }

  return {
    merchantName,
    amount: total,
    subtotal,
    taxAmount: resolvedTaxAmount,
    date,
    time: firstString(raw.time),
    currency,
    location: firstString(raw.location) || 'UNKNOWN',
    invoiceNumber: firstString(raw.invoiceNumber),
    items: Array.isArray(raw.items) ? raw.items : undefined,
    taxBreakdown,
    paymentMethod: firstString(raw.paymentMethod),
    category: firstString(raw.category),
    subcategory: firstString(raw.subcategory),
    description: firstString(raw.description),
    validationResult,
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

    // ── AI quota enforcement ────────────────────────────────────────
    const quota = await incrementAIUsage(userId);
    if (!quota.allowed) {
      audit({ event: 'ai.quota_exceeded', userId, meta: { current: quota.current, limit: quota.limit } });
      return res.status(429).json({
        error: 'Daily AI scan limit reached. Please try again tomorrow.',
        limit: quota.limit,
        remaining: 0,
      });
    }

    const validated = await validateBillUpload(file);
    if (validated.kind !== 'image') {
      return res.status(400).json({ error: 'Cloud OCR supports image files only' });
    }

    const processed = await processImage(validated.buffer);
    let raw: JsonMap = {};
    let source = 'unknown';

    audit({ event: 'ai.ocr_request', userId, meta: { fileSize: file.size, contentType: validated.contentType } });

    // Try Gemini OCR first if API key is present
    if (process.env.GOOGLE_API_KEY) {
      try {
        raw = await scanReceiptWithGemini(processed.buffer, processed.contentType);
        source = 'gemini-1.5-flash';
        audit({ event: 'ai.ocr_success', userId, meta: { source } });
        logger.info('Receipt scan successful via Gemini', { userId, source });
      } catch (geminiError: unknown) {
        const errObj = geminiError as { status?: number; message?: string };
        if (errObj?.status === 429) {
          logger.warn('Gemini OCR rate limit reached', { userId });
          return res.status(429).json({ error: 'AI rate limit reached. Please wait a minute before scanning again.' });
        }
        if (errObj?.message?.includes('Circuit breaker OPEN')) {
          audit({ event: 'security.circuit_open', userId, meta: { circuit: 'gemini-ocr' } });
        }
        audit({ event: 'ai.ocr_failure', userId, meta: { error: errObj?.message, source: 'gemini' } });
        logger.warn('Gemini OCR fallback triggered', { userId, error: errObj?.message || geminiError });
      }
    }

    // Fallback to legacy OCR via circuit breaker
    if (source === 'unknown') {
      try {
        raw = await withCircuitBreaker(
          { name: 'cloud-donut', failureThreshold: 3, resetTimeoutMs: 120_000 },
          async () => {
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

            if (!upstream.ok) {
              const errorBody = await extractJson(upstream);
              logger.warn('Receipt OCR upstream failed', { userId, status: upstream.status, error: errorBody });
              throw new Error(`Upstream OCR returned ${upstream.status}`);
            }

            return extractJson(upstream);
          },
        );
        source = 'cloud-donut';
        audit({ event: 'ai.ocr_success', userId, meta: { source } });
      } catch (donutError: unknown) {
        const errMsg = donutError instanceof Error ? donutError.message : String(donutError);
        audit({ event: 'ai.ocr_failure', userId, meta: { error: errMsg, source: 'cloud-donut' } });
        logger.warn('Cloud Donut OCR fallback failed', { userId, error: errMsg });
      }
    }

    if (source === 'unknown') {
      return res.status(500).json({ error: 'Failed to process receipt with any available model' });
    }

    const normalized = normalizeOcrResponse(raw);
    const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.85;

    // Persist AI scan result for audit trail
    const startTime = Date.now();
    const aiScan = await prisma.aiScan.create({
      data: {
        id: randomUUID(),
        userId,
        extractedJson: JSON.stringify(normalized),
        confidence,
        provider: source,
        processingMs: Date.now() - startTime,
        status: 'completed',
      },
    });

    eventBus.emit({
      type: 'AI_SCAN_COMPLETED',
      payload: { userId, billId: aiScan.id, success: true },
    });

    return res.json({
      ...normalized,
      source,
      scanId: aiScan.id,
      confidence,
      requiresConfirmation: true,
      quota: { remaining: quota.remaining, limit: quota.limit },
    });
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    if (errObj?.name === 'AbortError') {
      return res.status(504).json({ error: 'Cloud OCR timeout' });
    }

    logger.error('Receipt cloud scan failed', {
      error: errObj?.message || error,
    });

    return res.status(500).json({ error: 'Failed to scan receipt' });
  }
};
