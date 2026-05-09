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
  const taxAmountRaw = parseNumber(raw.totalTaxAmount) ?? parseNumber(raw.taxAmount);
  const subtotal = parseNumber(raw.preTaxSubtotal) ?? parseNumber(raw.subtotal);
  const discount = parseNumber(raw.discountAmount) ?? parseNumber(raw.discount);

  // Identify "Net Total" = after-discount, BEFORE tax (e.g. 59 on an Indian bill)
  // This must NEVER be used as the grand total candidate.
  const printedNetTotal = parseNumber(raw.nett) ?? parseNumber(raw.net_total);

  // Grand-total candidates — explicitly exclude net_total / nett (pre-tax)
  const totalCandidates = [
    parseNumber(raw.netAmount),        // AI field for Grand Total
    parseNumber(raw.grand_total),
    parseNumber(raw.amount_payable),
    parseNumber(raw.total_payable),
    parseNumber(raw.total),
    parseNumber(raw.total_amount),
    parseNumber(raw.amount),
  ].filter((v): v is number => v !== undefined && v > 0);

  const taxBreakdown = Array.isArray(raw.taxBreakdown)
    ? (raw.taxBreakdown as Array<{ name: string; rate?: number; amount: number }>)
        .filter((t) => t?.name && typeof t?.amount === 'number')
    : Array.isArray(raw.taxes)
      ? (raw.taxes as Array<{ name: string; rate?: number; amount: number }>)
      : undefined;

  const derivedTaxTotal = taxBreakdown && taxBreakdown.length > 0
    ? Number(taxBreakdown.reduce((s, t) => s + (t.amount || 0), 0).toFixed(2))
    : undefined;
  let resolvedTaxAmount = taxAmountRaw ?? derivedTaxTotal;

  // INDIAN TAX HEURISTIC: If only CGST is found (SGST typically mirrors it),
  // double the visible tax to produce the actual total tax.
  if (
    taxBreakdown &&
    taxBreakdown.length === 1 &&
    taxBreakdown[0].name.toUpperCase().includes('CGST') &&
    resolvedTaxAmount
  ) {
    resolvedTaxAmount = Number((resolvedTaxAmount * 2).toFixed(2));
  }

  // Prefer the largest grand-total candidate.
  let total = totalCandidates.length > 0 ? Math.max(...totalCandidates) : undefined;

  // If the candidates only returned the net total (pre-tax), compute the real total.
  if (
    total !== undefined &&
    printedNetTotal !== undefined &&
    Math.abs(total - printedNetTotal) < 0.5 &&
    (resolvedTaxAmount || 0) > 0
  ) {
    const calculatedPayable = Number((printedNetTotal + (resolvedTaxAmount || 0)).toFixed(2));
    const closerCandidate = totalCandidates.find((v) => Math.abs(v - calculatedPayable) < 2.0);
    total = closerCandidate ?? calculatedPayable;
  }

  // If we have a printedNetTotal and taxes but no other grand-total candidate, reconstruct.
  if (total === undefined && printedNetTotal !== undefined && (resolvedTaxAmount || 0) > 0) {
    total = Number((printedNetTotal + (resolvedTaxAmount || 0)).toFixed(2));
  }

  // DEFENSIVE DISCOUNT INFERENCE:
  let resolvedDiscount = discount || 0;
  if (subtotal && total && subtotal > total && resolvedDiscount === 0) {
    const impliedDiscount = subtotal + (resolvedTaxAmount || 0) - total;
    if (impliedDiscount > 0 && impliedDiscount < subtotal * 0.5) {
      resolvedDiscount = Number(impliedDiscount.toFixed(2));
    }
  }

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

  // VALIDATION: Only meaningful when we have an independently observed subtotal
  // (i.e. the subtotal came from the OCR output, not computed from the total).
  // Avoids the circular case where subtotal = total - tax → calculated always = total.
  let validationResult: { isValid: boolean; calculated: number; detected: number } | undefined;
  const hasIndependentSubtotal =
    subtotal !== undefined &&
    (parseNumber(raw.preTaxSubtotal) !== undefined || parseNumber(raw.subtotal) !== undefined);

  if (total !== undefined && hasIndependentSubtotal && subtotal !== undefined) {
    const calculated = Number((subtotal - resolvedDiscount + (resolvedTaxAmount || 0)).toFixed(2));
    validationResult = {
      isValid: Math.abs(calculated - total) < 2.0,
      calculated,
      detected: total,
    };
  }

  return {
    merchantName,
    amount: total,
    subtotal,
    taxAmount: resolvedTaxAmount,
    discountAmount: resolvedDiscount || undefined,
    date,
    time: firstString(raw.time),
    currency,
    location: firstString(raw.location) || 'UNKNOWN',
    invoiceNumber: firstString(raw.invoiceNumber),
    gstin: firstString(raw.gstin, raw.gstNo, raw.gst_no, raw.tin),
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

/**
 * Parse raw OCR.space plain text into a structured JsonMap.
 * Handles typical Indian retail receipt layouts:
 *   MERCHANT NAME
 *   ITEM     QTY  PRICE  AMOUNT
 *   Sub Total        65
 *   Dis               6
 *   Net Total        59
 *   CGST @9%       5.31
 *   SGST @9%       5.31
 *   Grand Total      70
 */
const parseOcrSpaceRawText = (rawText: string): JsonMap => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const result: JsonMap = {};

  // Extract numbers from end of line: "Grand Total    70.00" → 70
  const extractLineAmount = (line: string): number | undefined => {
    const m = line.match(/([\d,]+\.?\d*)\s*$/);
    if (!m) return undefined;
    const n = parseFloat(m[1].replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  // Identify merchant: first meaningful non-numeric, non-label line
  const labelPattern = /^(sub|net|dis|tax|cgst|sgst|igst|gst|total|grand|amount|invoice|bill|date|time|phone|tel|gstin|table|token|rs\.?|inr|qty|rate|mrp|item|particulars|sl)/i;
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 3 && !labelPattern.test(line) && !/^\d/.test(line) && !result.merchantName) {
      result.merchantName = line;
    }
  }

  const taxBreakdown: Array<{ name: string; rate?: number; amount: number }> = [];
  const items: Array<{ name: string; quantity?: number; rate?: number; amount: number }> = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const amount = extractLineAmount(line);

    // Date
    if (!result.date) {
      const dateMatch = line.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
      if (dateMatch) {
        const [, d, m, y] = dateMatch;
        const year = y.length === 2 ? `20${y}` : y;
        result.date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    // Time
    if (!result.time && /\d{1,2}:\d{2}/.test(line)) {
      const tm = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (tm) result.time = tm[1];
    }

    // Invoice / Bill number
    if (!result.invoiceNumber && /(bill|invoice|token|receipt)\s*(no\.?|#|number)?\s*[:\s]\s*(\w+)/i.test(line)) {
      const m2 = line.match(/(bill|invoice|token|receipt)\s*(no\.?|#|number)?\s*[:\s]\s*(\w+)/i);
      if (m2) result.invoiceNumber = m2[3];
    }

    // GSTIN
    if (!result.gstin) {
      const gstMatch = line.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/);
      if (gstMatch) result.gstin = gstMatch[0];
    }

    // Payment method
    if (!result.paymentMethod && /(upi|cash|card|gpay|paytm|credit|debit|neft|imps|netbanking)/i.test(line)) {
      const pm = line.match(/(upi|cash|card|gpay|paytm|credit|debit|neft|imps|netbanking)/i);
      if (pm) result.paymentMethod = pm[1].toUpperCase();
    }

    if (amount === undefined) continue;

    // Totals
    if (/grand\s*total|amount\s*payable|net\s*payable|total\s*amount\s*due/i.test(lower)) {
      result.netAmount = amount;
    } else if (/^sub\s*total|subtotal/i.test(lower)) {
      result.preTaxSubtotal = amount;
    } else if (/^(dis\b|discount)/i.test(lower)) {
      result.discountAmount = amount;
    } else if (/net\s*total|taxable\s*value|net\s*amt/i.test(lower)) {
      result.net_total = amount;
    } else if (/^total/i.test(lower) && !result.netAmount) {
      result.total = amount;
    }

    // Tax lines: CGST @9% 5.31
    const taxMatch = line.match(/^(CGST|SGST|IGST|GST|VAT|Service\s*Tax|Service\s*Charge)\s*(?:@\s*([\d.]+)\s*%?)?/i);
    if (taxMatch) {
      taxBreakdown.push({
        name: taxMatch[1].toUpperCase(),
        rate: taxMatch[2] ? parseFloat(taxMatch[2]) : undefined,
        amount,
      });
    }
  }

  // Extract items: lines like "MEDU WADA    1   65   65"
  for (const line of lines) {
    const itemMatch = line.match(/^([A-Za-z][A-Za-z\s]{2,30})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s*$/);
    if (itemMatch) {
      const [, name, qty, rate, amt] = itemMatch;
      items.push({
        name: name.trim(),
        quantity: parseInt(qty),
        rate: parseFloat(rate),
        amount: parseFloat(amt),
      });
    }
  }

  if (taxBreakdown.length > 0) result.taxBreakdown = taxBreakdown as unknown as string;
  if (items.length > 0) result.items = items as unknown as string;
  result.currency = 'INR';

  return result;
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

const OCR_JOBS = new Map<string, { status: string; data?: any; error?: string }>();

const executeFullOcrPipeline = async (userId: string, file: any, validated: any) => {
  const processed = await processImage(validated.buffer);
  let raw: JsonMap = {};
  let source = 'unknown';

  audit({ event: 'ai.ocr_request', userId, meta: { fileSize: file.size, contentType: validated.contentType } });

  // 1. Try Gemini OCR first
  if (process.env.GOOGLE_API_KEY) {
    try {
      raw = await scanReceiptWithGemini(processed.buffer, processed.contentType);
      source = 'gemini-1.5-flash';
      audit({ event: 'ai.ocr_success', userId, meta: { source } });
    } catch (err: any) {
      audit({ event: 'ai.ocr_failure', userId, meta: { error: err.message, source: 'gemini' } });
      logger.warn('Gemini OCR failed, falling back...', { userId, error: err.message });
    }
  }

  // 2. Fallback to OCR.space
  if (source === 'unknown' && process.env.RECEIPT_OCR_API_KEY) {
    try {
      raw = await withCircuitBreaker(
        { name: 'cloud-ocr-space', failureThreshold: 3, resetTimeoutMs: 120_000 },
        async () => {
          const formData = new FormData();
          formData.append('apikey', process.env.RECEIPT_OCR_API_KEY || '');
          formData.append('isOverlayRequired', 'true');
          formData.append('isTable', 'true');
          formData.append('OCREngine', '2');
          formData.append('file', new Blob([new Uint8Array(processed.buffer)], { type: processed.contentType }));

          const endpoint = getReceiptOcrEndpoint();
          const upstream = await fetch(endpoint, {
            method: 'POST',
            body: formData,
          });

          if (!upstream.ok) throw new Error(`Upstream OCR returned ${upstream.status}`);

          const ocrSpaceResult = await extractJson(upstream);
          if (Array.isArray(ocrSpaceResult.ParsedResults) && ocrSpaceResult.ParsedResults.length > 0) {
            const rawText = ocrSpaceResult.ParsedResults[0].ParsedText as string || '';
            // Parse the plain text into structured fields immediately
            const parsed = parseOcrSpaceRawText(rawText);
            parsed._rawOcrText = rawText;
            parsed.confidence = 0.78;
            return parsed;
          }
          return ocrSpaceResult;
        },
      );
      source = 'ocr-space';
      audit({ event: 'ai.ocr_success', userId, meta: { source } });
    } catch (err: any) {
      audit({ event: 'ai.ocr_failure', userId, meta: { error: err.message, source: 'ocr-space' } });
    }
  }

  if (source === 'unknown') {
    throw new Error('Failed to process receipt with any available model');
  }

  const normalized = normalizeOcrResponse(raw);
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.85;

  return { normalized, source, confidence };
};

export const startReceiptScan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const file = req.file;
    if (!file) {
      logger.warn('startReceiptScan: No file provided');
      return res.status(400).json({ error: 'Receipt image file is required' });
    }

    const jobId = randomUUID();
    OCR_JOBS.set(jobId, { status: 'processing' });

    (async () => {
      try {
        const validated = await validateBillUpload(file);
        if (validated.kind !== 'image') throw new Error('Unsupported file type');

        const { normalized } = await executeFullOcrPipeline(userId, file, validated);
        OCR_JOBS.set(jobId, { status: 'completed', data: normalized });
        audit({ event: 'ai.ocr_success', userId, meta: { jobId } });
      } catch (err: any) {
        logger.error('Background OCR failed', { jobId, error: err.message, stack: err.stack });
        OCR_JOBS.set(jobId, { status: 'failed', error: err.message });
      }
    })();

    return res.json({ job_id: jobId, status: 'processing' });
  } catch (error: any) {
    logger.error('Failed to start OCR job', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Failed to start OCR job' });
  }
};

export const getScanStatus = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const job = OCR_JOBS.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json(job);
};

export const scanReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Receipt image file is required' });

    const quota = await incrementAIUsage(userId);
    if (!quota.allowed) {
      return res.status(429).json({ error: 'Daily AI scan limit reached' });
    }

    const validated = await validateBillUpload(file);
    if (validated.kind !== 'image') return res.status(400).json({ error: 'Images only' });

    const { normalized, source, confidence } = await executeFullOcrPipeline(userId, file, validated);

    // Persist scan result (Fail-safe: Don't crash if DB is down)
    try {
      const startTime = Date.now();
      await prisma.aiScan.create({
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
    } catch (dbError: any) {
      logger.warn('Failed to persist AI scan to DB, continuing anyway', { error: dbError.message });
    }

    return res.json({
      ...normalized,
      source,
      confidence,
      requiresConfirmation: true,
      quota: { remaining: quota.remaining, limit: quota.limit },
    });
  } catch (error: any) {
    logger.error('Receipt scan failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: error.message || 'Failed to scan receipt' });
  }
};
