// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { documentIntelligenceService } from './documentIntelligenceService';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface ReceiptScannerResult {
  merchantName?: string;
  amount?: number;
  date?: Date;
  time?: string;
  currency?: string;
  taxAmount?: number;
  subtotal?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  items?: Array<{ name: string; amount: number }>;
  confidence?: number;
  rawText?: string;
}

export const SUPPORTED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

const RECEIPT_TOTAL_PATTERNS = [
  /grand\s*total/i,
  /total\s*amount/i,
  /total\s*payable/i,
  /amount\s*payable/i,
  /amount\s*paid/i,
  /amount\s*due/i,
  /balance\s*due/i,
  /net\s*total/i,
  /bill\s*total/i,
  /total/i,
];

const RECEIPT_SUBTOTAL_PATTERNS = [/sub\s*total/i, /subtotal/i];
const RECEIPT_TAX_PATTERNS = [/tax/i, /vat/i, /gst/i, /service\s*tax/i];
const PAYMENT_METHOD_PATTERNS = [
  { label: 'Visa', pattern: /\bvisa\b/i },
  { label: 'Mastercard', pattern: /\bmaster\s*card\b/i },
  { label: 'UPI', pattern: /\bupi\b/i },
  { label: 'Cash', pattern: /\bcash\b/i },
  { label: 'Bank Transfer', pattern: /\bneft\b|\bimps\b|\brtgs\b/i },
];

const BILL_MERCHANT_HINTS = [
  /amazon\./i,
  /flipkart/i,
  /myntra/i,
  /swiggy/i,
  /zomato/i,
  /bigbasket/i,
  /zepto/i,
];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractAmounts = (text: string) => {
  const matches = text.match(/(?:rs\.?|inr|₹|€|£|\$)?\s*\(?\s*[\d]{1,3}(?:,[\d]{2,3})*(?:\.\d{1,2})?\s*\)?/gi) || [];

  return matches
    .map((match) => {
      const normalized = match
        .replace(/rs\.?|inr|₹|€|£|\$/gi, '')
        .replace(/[()\s]/g, '')
        .replace(/,/g, '');

      return Number.parseFloat(normalized);
    })
    .filter((value) => Number.isFinite(value) && value > 0 && value < 100000000);
};

const extractDate = (lines: string[]) => {
  const datePatterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,
    /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})/i,
  ];

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const prioritizedLines = [
    ...lines.filter((line) => /invoice\s*date|order\s*date|bill\s*date|date\s*:/i.test(line)),
    ...lines,
  ];

  for (const line of prioritizedLines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (!match) continue;

      if (pattern.source.startsWith('(\\d{4})')) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }

      if (/jan|feb|mar/i.test(pattern.source)) {
        const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
        return new Date(year, monthMap[match[2].slice(0, 3).toLowerCase()], Number(match[1]));
      }

      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
      return new Date(year, Number(match[2]) - 1, Number(match[1]));
    }
  }

  return undefined;
};

const extractTime = (lines: string[]) => {
  for (const line of lines) {
    const match = line.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?)\b/i);
    if (match) return match[1].toUpperCase();
  }

  return undefined;
};

const extractInvoiceNumber = (lines: string[]) => {
  for (const line of lines) {
    const match = line.match(/(?:invoice|bill|receipt|txn|ref|order)(?:\s*(?:number|num|no)\.?|\s*#|\s*:)?\s*([a-z0-9][a-z0-9\-\/]{3,})/i);
    if (match) return match[1].toUpperCase();
  }

  return undefined;
};

const extractPaymentMethod = (lines: string[]) => {
  const joined = lines.join(' ');
  return PAYMENT_METHOD_PATTERNS.find((item) => item.pattern.test(joined))?.label;
};

const extractSectionAmount = (lines: string[], patterns: RegExp[]) => {
  let best = 0;

  for (const line of lines) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const amounts = extractAmounts(line);
    if (amounts.length === 0) continue;
    best = Math.max(best, Math.max(...amounts));
  }

  return best || undefined;
};

const extractBestTotalAmount = (lines: string[]) => {
  const candidates: Array<{ index: number; amount: number }> = [];

  lines.forEach((line, index) => {
    const normalized = normalizeWhitespace(line).toLowerCase();
    if (!RECEIPT_TOTAL_PATTERNS.some((pattern) => pattern.test(normalized))) return;
    if (RECEIPT_SUBTOTAL_PATTERNS.some((pattern) => pattern.test(normalized))) return;
    if (RECEIPT_TAX_PATTERNS.some((pattern) => pattern.test(normalized))) return;

    // Skip per-line item totals in tabular invoices.
    if (/\bqty|quantity|unit\s*price|tax\s*type|description\b/i.test(normalized)) return;

    const amounts = extractAmounts(line);
    if (amounts.length > 0) {
      candidates.push({ index, amount: Math.max(...amounts) });
      return;
    }

    // Some bills split TOTAL and value on the next line.
    const nextLine = lines[index + 1] || '';
    const nextAmounts = extractAmounts(nextLine);
    if (nextAmounts.length > 0) {
      candidates.push({ index: index + 1, amount: Math.max(...nextAmounts) });
    }
  });

  if (candidates.length === 0) return undefined;

  // Totals usually appear near the end. Prefer the last meaningful total line.
  const lastCandidate = candidates.reduce((latest, current) => (current.index > latest.index ? current : latest));
  return lastCandidate.amount;
};

const detectMerchantLine = (lines: string[]) => {
  const prioritized = lines.find((line) => BILL_MERCHANT_HINTS.some((pattern) => pattern.test(line)));
  if (prioritized) return prioritized;

  const domainLine = lines.find((line) => /\b[a-z0-9-]+\.(?:in|com|co|org)\b/i.test(line));
  if (domainLine) return domainLine;

  const merchantCandidates = lines.filter((line) =>
    line.length > 2
    && !/^\d/.test(line)
    && !/date|time|invoice|bill no|gst|tax|tel|phone|www\.|address|sold by|shipping|authorized|signatory/i.test(line),
  );

  return merchantCandidates[0] ?? '';
};

const extractItems = (lines: string[]) => {
  const items: Array<{ name: string; amount: number }> = [];

  for (const line of lines) {
    if (RECEIPT_TOTAL_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (RECEIPT_SUBTOTAL_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (RECEIPT_TAX_PATTERNS.some((pattern) => pattern.test(line))) continue;

    const amounts = extractAmounts(line);
    if (amounts.length !== 1) continue;

    const name = normalizeWhitespace(line.replace(/(?:rs\.?|₹|€|£|\$|usd|eur|gbp|inr)?\s*[\d,]+(?:\.\d{1,2})?/gi, ' '));
    if (name.length < 3) continue;
    items.push({ name, amount: amounts[0] });
  }

  return items.slice(0, 12);
};

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
      }
      resolve(blob);
    }, 'image/png', 0.96);
  });
}

async function renderPdfToCanvas(file: File) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer, disableFontFace: true }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function loadImageToCanvas(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Failed to load receipt image'));
      element.src = imageUrl;
    });

    const scale = Math.min(1, 2200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context unavailable');
    }

    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function trimCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let foundInk = false;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4;
      const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (luminance < 245) {
        foundInk = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!foundInk) return canvas;

  const padding = 16;
  const trimmedCanvas = document.createElement('canvas');
  const width = Math.max(1, maxX - minX + padding * 2);
  const height = Math.max(1, maxY - minY + padding * 2);
  trimmedCanvas.width = width;
  trimmedCanvas.height = height;
  const trimmedContext = trimmedCanvas.getContext('2d');

  if (!trimmedContext) return canvas;

  trimmedContext.fillStyle = '#ffffff';
  trimmedContext.fillRect(0, 0, width, height);
  trimmedContext.drawImage(
    canvas,
    Math.max(minX - padding, 0),
    Math.max(minY - padding, 0),
    Math.min(canvas.width - minX, maxX - minX + padding * 2),
    Math.min(canvas.height - minY, maxY - minY + padding * 2),
    0,
    0,
    width,
    height,
  );

  return trimmedCanvas;
}

function enhanceCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  let minLum = 255;
  let maxLum = 0;

  for (let index = 0; index < data.length; index += 4) {
    const lum = (data[index] + data[index + 1] + data[index + 2]) / 3;
    minLum = Math.min(minLum, lum);
    maxLum = Math.max(maxLum, lum);
  }

  const dynamicRange = Math.max(1, maxLum - minLum);

  for (let index = 0; index < data.length; index += 4) {
    const lum = (data[index] + data[index + 1] + data[index + 2]) / 3;
    const normalized = ((lum - minLum) / dynamicRange) * 255;
    const boosted = normalized > 180 ? 255 : normalized < 80 ? 0 : Math.min(255, normalized * 1.08);
    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function upscaleCanvasForOcr(canvas: HTMLCanvasElement) {
  const minShortEdge = 1400;
  const shortEdge = Math.min(canvas.width, canvas.height);
  if (shortEdge >= minShortEdge) return canvas;

  const scale = minShortEdge / Math.max(shortEdge, 1);
  const upscaled = document.createElement('canvas');
  upscaled.width = Math.max(1, Math.round(canvas.width * scale));
  upscaled.height = Math.max(1, Math.round(canvas.height * scale));
  const context = upscaled.getContext('2d');
  if (!context) return canvas;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, upscaled.width, upscaled.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
  return upscaled;
}

export async function preprocessReceiptFile(file: File) {
  const baseCanvas = file.type === 'application/pdf'
    ? await renderPdfToCanvas(file)
    : await loadImageToCanvas(file);

  const trimmed = trimCanvas(baseCanvas);
  const enhanced = enhanceCanvas(trimmed);
  const upscaled = upscaleCanvasForOcr(enhanced);
  return canvasToBlob(upscaled);
}

export async function parseReceiptText(rawText: string, userId?: string): Promise<ReceiptScannerResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const merchantLine = detectMerchantLine(lines);
  const normalizedMerchant = documentIntelligenceService.normalizeMerchantName(merchantLine);
  const merchantName = normalizedMerchant
    ? documentIntelligenceService.toTitleCase(normalizedMerchant)
    : merchantLine;
  const subtotal = extractSectionAmount(lines, RECEIPT_SUBTOTAL_PATTERNS);
  const taxAmount = extractSectionAmount(lines, RECEIPT_TAX_PATTERNS);
  const amount = extractBestTotalAmount(lines)
    ?? extractSectionAmount(lines, RECEIPT_TOTAL_PATTERNS)
    ?? Math.max(0, ...lines.flatMap((line) => extractAmounts(line)));
  const date = extractDate(lines);
  const time = extractTime(lines);
  const paymentMethod = extractPaymentMethod(lines);
  const invoiceNumber = extractInvoiceNumber(lines);
  const items = extractItems(lines);
  const currency = documentIntelligenceService.detectCurrency(rawText);
  const categoryPrediction = await documentIntelligenceService.predictCategory({
    merchantName,
    text: [merchantLine, ...items.map((item) => item.name), rawText].join(' '),
    amount,
    userId,
  });
  const notes = categoryPrediction.category !== 'Others'
    ? `${categoryPrediction.category.toLowerCase()} receipt`
    : 'receipt import';

  return {
    merchantName,
    amount,
    date,
    time,
    currency,
    taxAmount,
    subtotal,
    paymentMethod,
    invoiceNumber,
    category: categoryPrediction.category,
    subcategory: items[0]?.name || '',
    notes,
    items,
    confidence: [
      merchantName ? 0.16 : 0,
      amount ? 0.26 : 0,
      date ? 0.16 : 0,
      paymentMethod ? 0.08 : 0,
      invoiceNumber ? 0.08 : 0,
      items.length > 0 ? 0.12 : 0,
      categoryPrediction.confidence * 0.14,
    ].reduce((sum, score) => sum + score, 0),
    rawText,
  };
}
