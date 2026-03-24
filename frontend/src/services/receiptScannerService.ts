// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import type {
  ReceiptLineItem,
  ReceiptScanResult,
  TaxComponent,
  TotalValidationResult,
} from '@/types/receipt.types';
import { documentIntelligenceService } from './documentIntelligenceService';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface ReceiptScannerResult extends ReceiptScanResult {}

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
  /amount\s*pay\w*/i,
  /amou\w*pay\w*/i,
  /amount\s*paid/i,
  /amount\s*due/i,
  /balance\s*due/i,
  /net\s*total/i,
  /net\s*amount/i,
  /net\s*mount/i,
  /bill\s*total/i,
  /total/i,
];

const RECEIPT_SUBTOTAL_PATTERNS = [/sub\s*total/i, /subtotal/i];
const RECEIPT_PRE_TAX_PATTERNS = [/bill\s*amount/i, /bill\s*total/i, /^\s*total\b/i];
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

const MERCHANT_NAME_HINTS = /restaurant|restro|cafe|coffee|tea|menu|kitchen|bar|bistro|grill|bakery|mart|store|supermarket|traders|emporium|foods?/i;
const MERCHANT_LINE_BLOCKLIST = /date|time|invoice|bill\s*no|token\s*no|table\s*no|w\.?\s*no|gst|tax|vat\s*tin|fssai|hsn|sac|tel|phone|mobile|www\.|http|address|road|street|lane|avenue|particulars|qty|quantity|rate|amount|subtotal|total|thank\s*you|visit\s*again|cashier|server/i;
const SUMMARY_BOUNDARY_PATTERNS = [
  /sub\s*total/i,
  /grand\s*total/i,
  /food\s*total/i,
  /net\s*total/i,
  /net\s*amount/i,
  /net\s*mount/i,
  /bill\s*amount/i,
  /amount\s*payable/i,
  /amount\s*pay\w*/i,
  /amou\w*pay\w*/i,
  /balance\s*due/i,
  /cgst/i,
  /sgst/i,
  /igst/i,
  /service\s*tax/i,
  /tax\s*:/i,
  /vat/i,
];
const FOOD_RECEIPT_HINTS = /restaurant|cafe|tea|coffee|menu|kitchen|food|dinner|lunch|breakfast|dessert|beverage|mojito|pizza|burger|biryani|thali|dosa|paneer|noodles|shake|juice|fssai|cgst|sgst|tax\s*invoice/i;
const GROCERY_RECEIPT_HINTS = /supermarket|mart|grocery|grocer|vegetable|fruit|milk|bread|rice|atta|dal|pulses|mrp/i;
const SHOPPING_RECEIPT_HINTS = /mall|fashion|apparel|clothing|retail|electronics|store/i;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeForMatching = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const countMatches = (value: string, pattern: RegExp) => value.match(pattern)?.length || 0;

const hasSummaryBoundary = (line: string) => {
  const normalizedLine = normalizeForMatching(line);
  return (
    SUMMARY_BOUNDARY_PATTERNS.some((pattern) => pattern.test(line) || pattern.test(normalizedLine))
    || /\b(?:discount|discounted|round off|roundof|net amount|net mount|bill amount|amount payable|service charge|service tax|cgst|sgst|igst)\b/i.test(normalizedLine)
    || /\b(?:vat|tax)\b.*\d/i.test(normalizedLine)
  );
};

const isMetadataLine = (line: string) => {
  const normalizedLine = normalizeForMatching(line);
  return (
    MERCHANT_LINE_BLOCKLIST.test(line)
    || /\b(?:rill|bill|invoice|receipt|token|table|cash memo|cashier|captain|phone|ph|gstin|gst no|vat tin|fssai|address|road|street|lane|avenue|table|stud|date|time)\b/i.test(normalizedLine)
  );
};

const extractAmounts = (text: string, options?: { allowLooseIntegers?: boolean }) => {
  const allowLooseIntegers = options?.allowLooseIntegers ?? false;
  const matches = text.match(/(?:rs\.?|inr|₹|€|£|\$)\s*\(?\s*\d[\d,]*(?:\.\d{1,2})?\s*\)?|\b\d[\d,]*\.\d{1,2}\b|\b\d{1,5}\b/gi) || [];

  return matches
    .map((match) => {
      const hasCurrencySymbol = /rs\.?|inr|₹|€|£|\$/i.test(match);
      const hasDecimalOrGrouping = /[\.,]/.test(match);
      const normalized = match
        .replace(/rs\.?|inr|₹|€|£|\$/gi, '')
        .replace(/[()\s]/g, '')
        .replace(/,/g, '');

      if (!normalized) return Number.NaN;
      if (!hasCurrencySymbol && !hasDecimalOrGrouping && !allowLooseIntegers) {
        return Number.NaN;
      }

      if (!hasCurrencySymbol && !hasDecimalOrGrouping && !/^\d{1,4}$/.test(normalized)) {
        return Number.NaN;
      }

      return Number.parseFloat(normalized);
    })
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1000000);
};

const isReasonableReceiptDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const tenYearsAgo = new Date(now);
  tenYearsAgo.setFullYear(now.getFullYear() - 10);
  const maxFuture = new Date(now);
  maxFuture.setDate(now.getDate() + 3);
  return date >= tenYearsAgo && date <= maxFuture;
};

const normalizeYear = (yearToken: string) => {
  const parsed = Number(yearToken);
  if (yearToken.length !== 2) return parsed;

  const currentYear = new Date().getFullYear();
  const candidate = 2000 + parsed;
  if (candidate <= currentYear + 1) return candidate;
  return candidate - 100;
};

const extractDate = (lines: string[]) => {
  const datePatterns: Array<{ re: RegExp; order: 'dmy' | 'ymd' | 'named' }> = [
    // Standard separators: / - .
    { re: /(\d{1,2})[\/ \-\.](\d{1,2})[\/ \-\.](\d{2,4})/, order: 'dmy' },
    { re: /(\d{4})[\/ \-\.](\d{1,2})[\/ \-\.](\d{1,2})/, order: 'ymd' },
    // OCR-garbled separators: | l (pipe/lowercase-L often misread from /)
    { re: /(\d{1,2})[|l](\d{1,2})[|l](\d{2,4})/, order: 'dmy' },
    // Spaced separators: "30 / 12 / 2024" or "30 - 12 - 2024"
    { re: /(\d{1,2})\s*[\/ \-\.]\s*(\d{1,2})\s*[\/ \-\.]\s*(\d{2,4})/, order: 'dmy' },
    // Named months
    { re: /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,.]?\s+(\d{2,4})/i, order: 'named' },
    // Month-first US style: "Dec 30, 2024"
    { re: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})[,.]?\s+(\d{2,4})/i, order: 'named' },
  ];

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const prioritizedLines = [
    ...lines.filter((line) => /invoice\s*date|order\s*date|bill\s*date|dt\.?\s*:?\s*\d|date\s*:?\s*\d/i.test(line)),
    ...lines,
  ];

  for (const line of prioritizedLines) {
    for (const { re, order } of datePatterns) {
      const match = line.match(re);
      if (!match) continue;

      if (order === 'ymd') {
        const candidate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (isReasonableReceiptDate(candidate)) return candidate;
        continue;
      }

      if (order === 'named') {
        // Find which capture group is the month name
        const monthStr = [match[1], match[2]].find((g) => /[a-z]/i.test(g));
        const dayStr = [match[1], match[2]].find((g) => /^\d+$/.test(g));
        const yearStr = match[3];
        if (!monthStr || !dayStr) continue;
        const year = normalizeYear(yearStr);
        const candidate = new Date(year, monthMap[monthStr.slice(0, 3).toLowerCase()], Number(dayStr));
        if (isReasonableReceiptDate(candidate)) return candidate;
        continue;
      }

      // DMY order — try dd/mm/yyyy first, then mm/dd/yyyy if day > 12
      const a = Number(match[1]);
      const b = Number(match[2]);
      const year = normalizeYear(match[3]);

      // Standard dd/mm/yyyy
      const dmyCandidate = new Date(year, b - 1, a);
      if (a <= 31 && b <= 12 && isReasonableReceiptDate(dmyCandidate)) return dmyCandidate;

      // Fallback mm/dd/yyyy (US-style)
      const mdyCandidate = new Date(year, a - 1, b);
      if (b <= 31 && a <= 12 && isReasonableReceiptDate(mdyCandidate)) return mdyCandidate;
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
    const match = line.match(/(?:invoice|bill|receipt|txn|ref|order)(?:\s*(?:number|num|no)\.?\s*:?|\s*#\s*:?|\s*:)?\s*([a-z0-9][a-z0-9\-\/]{2,})/i);
    if (match) return match[1].toUpperCase();
  }

  return undefined;
};

const extractPaymentMethod = (lines: string[]) => {
  const joined = lines.join(' ');
  return PAYMENT_METHOD_PATTERNS.find((item) => item.pattern.test(joined))?.label;
};

const extractSectionAmount = (lines: string[], patterns: RegExp[], lineGuard?: (line: string) => boolean) => {
  let best = 0;

  for (const line of lines) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    if (lineGuard && !lineGuard(line)) continue;
    const amounts = extractAmounts(line, { allowLooseIntegers: true });
    if (amounts.length === 0) continue;
    best = Math.max(best, Math.max(...amounts));
  }

  return best || undefined;
};

const extractPretaxAmount = (lines: string[]) =>
  extractSectionAmount(
    lines,
    RECEIPT_PRE_TAX_PATTERNS,
    (line) => !/amount\s*payable|net\s*amount|grand\s*total/i.test(line),
  );

const toRoundedAmount = (value: number) => Number(value.toFixed(2));

const normalizeTaxLabel = (line: string) => {
  const normalizedLine = normalizeForMatching(line);
  if (/c\.?g\.?s\.?t/i.test(line)) return 'CGST';
  if (/s\.?g\.?s\.?t/i.test(line)) return 'SGST';
  if (/i\.?g\.?s\.?t/i.test(line)) return 'IGST';
  if (/service\s*charge/i.test(line)) return 'Service Charge';
  if (/service\s*tax|s\.?\s*tax/i.test(line)) return 'Service Tax';
  if (/\bstx\b/i.test(line)) return 'STX';
  if (/\bvat\b/i.test(line)) return 'VAT';
  if (/\bvan\b/i.test(normalizedLine)) return 'VAT';
  if (/\bgst\b/i.test(line)) return 'GST';
  if (/\btax\b/i.test(line)) return 'Tax';

  const label = normalizeWhitespace(
    line
      .replace(/\b(?:rs\.?|inr|₹|€|£|\$)\b/gi, ' ')
      .replace(/\d[\d,.]*(?:\s*%+)?/g, ' ')
      .replace(/[:()@]+/g, ' ')
      .replace(/\s+/g, ' '),
  );

  return label || 'Tax';
};

const extractTaxBreakdown = (lines: string[]): TaxComponent[] => {
  const taxBreakdown: TaxComponent[] = [];

  for (const line of lines) {
    const normalizedLine = normalizeForMatching(line);
    if (
      !(
        /(c\.?g\.?s\.?t|s\.?g\.?s\.?t|i\.?g\.?s\.?t|\bgst\b|\bvat\b|service\s*tax|service\s*charge|\bstx\b|\btax\b)/i.test(line)
        || /\b(?:c gst|s gst|igst|gst|vat|van|service tax|service charge|stx|tax)\b/i.test(normalizedLine)
      )
      || /gstin|gst\s*(?:no|in|reg)|vat\s*tin|fssai|invoice\s*no|bill\s*no|registration|tax\s*invoice/i.test(normalizedLine)
    ) {
      continue;
    }

    const amounts = extractAmounts(line, { allowLooseIntegers: true });
    if (amounts.length === 0) continue;

    const amount = amounts[amounts.length - 1];
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const rateMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
    taxBreakdown.push({
      name: normalizeTaxLabel(line),
      rate: rateMatch ? Number.parseFloat(rateMatch[1]) : undefined,
      amount: toRoundedAmount(amount),
    });
  }

  return taxBreakdown;
};

const extractTaxAmount = (lines: string[], taxBreakdown?: TaxComponent[]) => {
  if (taxBreakdown && taxBreakdown.length > 0) {
    return toRoundedAmount(taxBreakdown.reduce((sum, component) => sum + component.amount, 0));
  }

  // Try standalone GST / tax amount lines
  const gstAmountLine = lines.find((line) =>
    /\bgst\b.*\d|\btax\s*(?:amount|amt)\s*:?\s*\d/i.test(line)
    && !/gstin|gst\s*(?:no|in|reg)|vat\s*tin|fssai|tax\s*invoice/i.test(line),
  );
  if (gstAmountLine) {
    const amounts = extractAmounts(gstAmountLine, { allowLooseIntegers: true });
    const taxAmount = amounts.find((a) => a > 0);
    if (taxAmount) return taxAmount;
  }

  return extractSectionAmount(
    lines,
    RECEIPT_TAX_PATTERNS,
    (line) => !/gstin|gst\s*(?:no|in|reg)|vat\s*tin|fssai|hsn|sac|registration|invoice\s*no|bill\s*no|tax\s*invoice|particulars|qty|quantity|rate|amount|w\.?\s*no|table/i.test(line),
  );
};

const scoreTotalCandidate = (line: string, index: number) => {
  let score = index * 0.05;
  if (/grand\s*total|food\s*total|net\s*total|net\s*amount|amount\s*payable|total\s*amount/i.test(line)) score += 3;
  else if (/\btotal\b/i.test(line)) score += 1;
  if (/\.\d{2}\b/.test(line)) score += 0.2;
  if (/sub\s*total/i.test(line)) score -= 4;
  if (/tax/i.test(line)) score -= 4;
  return score;
};

const extractBestTotalAmount = (lines: string[]) => {
  const candidates: Array<{ index: number; amount: number }> = [];

  lines.forEach((line, index) => {
    const normalized = normalizeWhitespace(line).toLowerCase();
    const normalizedMatchLine = normalizeForMatching(line);
    if (!RECEIPT_TOTAL_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(normalizedMatchLine))) return;
    if (RECEIPT_SUBTOTAL_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(normalizedMatchLine))) return;
    if (RECEIPT_TAX_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(normalizedMatchLine))) return;

    // Skip per-line item totals in tabular invoices.
    if (/\bqty|quantity|unit\s*price|tax\s*type|description\b/i.test(normalized)) return;

    const amounts = extractAmounts(line, { allowLooseIntegers: true });
    if (amounts.length > 0) {
      candidates.push({ index, amount: Math.max(...amounts) });
      return;
    }

    // Some bills split TOTAL and value on the next line.
    const nextLine = lines[index + 1] || '';
    const nextAmounts = extractAmounts(nextLine, { allowLooseIntegers: true });
    if (nextAmounts.length > 0) {
      candidates.push({ index: index + 1, amount: Math.max(...nextAmounts) });
    }
  });

  if (candidates.length === 0) return undefined;

  const bestCandidate = candidates.reduce((best, current) => {
    const bestScore = scoreTotalCandidate(lines[best.index] || '', best.index);
    const currentScore = scoreTotalCandidate(lines[current.index] || '', current.index);

    if (currentScore > bestScore) return current;
    if (currentScore === bestScore && current.index > best.index) return current;
    return best;
  });

  return bestCandidate.amount;
};

const detectMerchantLine = (lines: string[]) => {
  const candidatePair = lines
    .slice(0, 3)
    .filter((line) => line.length >= 2 && line.length <= 28 && /[a-z]{2,}/i.test(line) && !isMetadataLine(line));
  if (candidatePair.length >= 2) {
    const combined = normalizeWhitespace(`${candidatePair[0]} ${candidatePair[1]}`);
    if (
      combined.length <= 42
      && !isMetadataLine(combined)
      && (
        /[&]$/.test(candidatePair[0])
        || MERCHANT_NAME_HINTS.test(candidatePair[1])
        || /\b(?:restaurant|cafe|hotel|foods?|kitchen|grill|mart|store|private|pvt|ltd)\b/i.test(candidatePair[1])
      )
    ) {
      return combined;
    }
  }

  const prioritized = lines.find((line) => BILL_MERCHANT_HINTS.some((pattern) => pattern.test(line)));
  if (prioritized) return prioritized;

  const domainLine = lines.find((line) => /\b[a-z0-9-]+\.(?:in|com|co|org)\b/i.test(line));
  if (domainLine) return domainLine;

  const scoredCandidate = lines
    .slice(0, 8)
    .map((line, index) => {
      const alphaCount = countMatches(line, /[a-z]/gi);
      const digitCount = countMatches(line, /\d/g);
      const uppercaseCount = countMatches(line, /[A-Z]/g);
      const tokenCount = normalizeWhitespace(line).split(' ').filter(Boolean).length;
      const uppercaseRatio = alphaCount > 0 ? uppercaseCount / alphaCount : 0;

      let score = 0;
      if (line.length >= 4 && line.length <= 40) score += 0.2;
      if (index <= 2) score += 0.25;
      if (index <= 5) score += 0.1;
      if (digitCount === 0) score += 0.25;
      if (uppercaseRatio >= 0.55) score += 0.15;
      if (tokenCount >= 1 && tokenCount <= 5) score += 0.1;
      if (MERCHANT_NAME_HINTS.test(line)) score += 0.2;
      if (isMetadataLine(line)) score -= 1;
      if (/^\d/.test(line)) score -= 0.3;
      if (digitCount > 4) score -= 0.3;

      return { line, score };
    })
    .sort((left, right) => right.score - left.score)[0];

  if (scoredCandidate && scoredCandidate.score > 0.2
    && scoredCandidate.line.length >= 3
    && /[a-z]{2,}/i.test(scoredCandidate.line)) {
    return scoredCandidate.line;
  }

  const merchantCandidates = lines.filter((line) =>
    line.length >= 3
    && /[a-z]{2,}/i.test(line)
    && !/^\d/.test(line)
    && !isMetadataLine(line),
  );

  return merchantCandidates[0] ?? '';
};

const normalizeItemName = (value: string) => normalizeWhitespace(
  value
    .replace(/^\d+\s+/, ' ')
    .replace(/^[^a-z0-9]+/i, ' ')
    .replace(/[^a-z0-9&()\/+,._\-\s]/gi, ' ')
    .replace(/\s*[|:]+\s*/g, ' '),
);

const isLikelyGarbageItemName = (value: string) => {
  const normalized = value.toLowerCase();
  const alphaOnlyToken = normalized.replace(/[^a-z]/g, '');
  const alphaMatches = value.match(/[a-z]/gi) || [];
  const alphaCount = alphaMatches.length;
  const compact = value.replace(/\s+/g, '');
  const compactLength = compact.length;

  if (value.length < 3) return true;
  if (alphaCount < 2) return true;
  if (compactLength > 0 && (alphaCount / compactLength) < 0.35) return true;
  if (/^(x+)$/i.test(compact)) return true;
  if (/(.)\1{3,}/i.test(compact)) return true;
  if (/^(ino|no|qty|gst|tax|total|bill|item|invoice)$/.test(alphaOnlyToken)) return true;
  if (/^(no|item|qty|tax|amount|total|subtotal|gst|cgst|sgst|invoice|bill)$/i.test(normalized)) return true;
  if (/^(i\s*no|i\s*no\s*&?)$/i.test(normalized)) return true;

  return false;
};

const deriveItemMetrics = (amounts: number[]) => {
  const itemAmount = amounts[amounts.length - 1];
  let quantity: number | undefined;
  let rate: number | undefined;

  if (amounts.length >= 3) {
    const maybeQuantity = amounts[amounts.length - 3];
    const maybeRate = amounts[amounts.length - 2];
    if (
      maybeQuantity > 0
      && maybeQuantity <= 100
      && maybeRate > 0
      && Math.abs((maybeQuantity * maybeRate) - itemAmount) <= Math.max(2, itemAmount * 0.08)
    ) {
      quantity = maybeQuantity;
      rate = maybeRate;
    }
  }

  if (!quantity && amounts.length >= 2) {
    const candidate = amounts[amounts.length - 2];

    if (candidate > 0 && candidate <= 100 && Number.isInteger(candidate)) {
      const derivedRate = itemAmount / candidate;
      if (derivedRate > 0 && Number.isFinite(derivedRate)) {
        quantity = candidate;
        rate = toRoundedAmount(derivedRate);
      }
    } else if (candidate > 0 && candidate <= itemAmount) {
      rate = candidate;
      const derivedQuantity = itemAmount / candidate;
      if (
        derivedQuantity > 0
        && derivedQuantity <= 100
        && Math.abs(Math.round(derivedQuantity) - derivedQuantity) <= 0.1
      ) {
        quantity = Math.round(derivedQuantity);
      }
    }
  }

  return {
    itemAmount: toRoundedAmount(itemAmount),
    quantity,
    rate: rate ? toRoundedAmount(rate) : undefined,
  };
};

const extractItems = (lines: string[], totalAmount?: number) => {
  const items: ReceiptLineItem[] = [];
  let reachedSummary = false;

  for (const line of lines) {
    const normalizedLine = normalizeForMatching(line);

    if (hasSummaryBoundary(line)) {
      reachedSummary = true;
      continue;
    }

    if (reachedSummary) continue;
    if (isMetadataLine(line)) continue;
    if (/\b(?:thank|visit again|chepauk|street|road|phone|captain|user id|thank you|cash rill|rill no|bill no|date)\b/i.test(normalizedLine)) continue;
    if (RECEIPT_TOTAL_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (RECEIPT_SUBTOTAL_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (RECEIPT_TAX_PATTERNS.some((pattern) => pattern.test(line))) continue;
    if (/invoice|receipt|gstin|fssai|phone|mobile|thank\s*you|visit\s*again|www\.|qty|quantity|item\s*code|particulars|rate|amount/i.test(line)) continue;

    const amounts = extractAmounts(line, { allowLooseIntegers: true });
    if (amounts.length === 0 || amounts.length > 4) continue;
    if (
      amounts.length === 1
      && /^\d+[,\s]/.test(line)
      && /\b(?:street|st|road|lane|avenue|nagar|station|centre|center|city|chepauk|janakpuri)\b/i.test(normalizedLine)
    ) {
      continue;
    }
    const { itemAmount, quantity, rate } = deriveItemMetrics(amounts);
    if (totalAmount && itemAmount > totalAmount) continue;

    const rawName = line.replace(/(?:rs\.?|₹|€|£|\$|usd|eur|gbp|inr)?\s*[\d,]+(?:\.\d{1,2})?/gi, ' ');
    const name = normalizeItemName(rawName);
    const normalizedName = normalizeForMatching(name);
    const tokens = name.split(/\s+/).filter(Boolean);
    const shortTokens = tokens.filter((token) => token.length <= 2).length;
    if (name.length < 3 || !/[a-z]/i.test(name)) continue;
    if (tokens.length > 0 && (shortTokens / tokens.length) > 0.5) continue;
    if (/invoice|receipt|gstin|fssai|phone|mobile|thank\s*you|www\.|qty|quantity|item\s*code/i.test(name)) continue;
    if (/\b(?:round off|roundof|round o\w*|net amount|net mount|amount payable|bill amount|discount|table|captain|date)\b/i.test(normalizedName)) continue;
    if (isLikelyGarbageItemName(name)) continue;
    items.push({
      name,
      quantity,
      rate,
      amount: itemAmount,
    });
  }

  return items.slice(0, 12);
};

const deriveCategoryHint = (
  rawText: string,
  merchantName: string,
  items: ReceiptLineItem[],
) => {
  const combined = `${merchantName} ${items.map((item) => item.name).join(' ')} ${rawText}`.toLowerCase();

  if (FOOD_RECEIPT_HINTS.test(combined)) return 'Food & Dining';
  if (GROCERY_RECEIPT_HINTS.test(combined)) return 'Groceries';
  if (SHOPPING_RECEIPT_HINTS.test(combined)) return 'Shopping';
  return undefined;
};

const buildValidationResult = (input: {
  amount?: number;
  subtotal?: number;
  taxAmount?: number;
  taxBreakdown?: TaxComponent[];
  items?: ReceiptLineItem[];
}): TotalValidationResult | undefined => {
  if (!input.amount || input.amount <= 0) return undefined;

  const subtotal = input.subtotal
    ?? (input.items && input.items.length > 0
      ? toRoundedAmount(input.items.reduce((sum, item) => sum + item.amount, 0))
      : 0);

  const taxAmount = input.taxAmount
    ?? (input.taxBreakdown && input.taxBreakdown.length > 0
      ? toRoundedAmount(input.taxBreakdown.reduce((sum, item) => sum + item.amount, 0))
      : 0);

  const calculated = toRoundedAmount(subtotal + taxAmount);
  if (calculated <= 0) return undefined;

  return {
    isValid: Math.abs(calculated - input.amount) <= Math.max(2, input.amount * 0.05),
    calculated,
    detected: toRoundedAmount(input.amount),
  };
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

function cloneCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return source;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0);
  return canvas;
}

async function renderPdfToCanvas(file: File) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ 
    data: buffer, 
    disableFontFace: true,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
  
  // Process first page for invoices, optimize for speed
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 }); // Reduced scale for faster processing
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Optimize rendering settings for speed
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'medium';
  
  await page.render({ 
    canvasContext: context, 
    viewport,
    intent: 'display' // Faster than 'print' intent
  }).promise;
  
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
  const minShortEdge = 1200; // Reduced from 1400 for faster processing
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
  context.imageSmoothingQuality = 'medium'; // Reduced quality for speed
  context.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
  return upscaled;
}

export async function preprocessReceiptFile(file: File): Promise<Blob> {
  // Fast path for PDF invoices
  if (file.type === 'application/pdf') {
    const canvas = await renderPdfToCanvas(file);
    const trimmed = trimCanvas(canvas);
    const enhanced = enhanceCanvas(trimmed);
    const upscaled = upscaleCanvasForOcr(enhanced);
    return canvasToBlob(upscaled);
  }
  
  // Optimized image processing
  const variants = await preprocessReceiptFileVariants(file);
  const enhancedVariant = variants.find((variant) => variant.label === 'enhanced');
  return enhancedVariant?.blob || variants[0].blob;
}

export async function preprocessReceiptFileVariants(file: File): Promise<Array<{ label: string; blob: Blob }>> {
  const baseCanvas = await loadImageToCanvas(file);
  const trimmed = trimCanvas(baseCanvas);

  // Skip variants derived from tiny trimmed canvases — Tesseract can't handle them
  if (trimmed.width < 32 || trimmed.height < 32) {
    return [];
  }

  // Parallel processing for faster variants generation
  const [cleanVariant, enhancedVariant] = await Promise.all([
    canvasToBlob(upscaleCanvasForOcr(cloneCanvas(trimmed))),
    canvasToBlob(upscaleCanvasForOcr(enhanceCanvas(cloneCanvas(trimmed)))),
  ]);

  return [
    { label: 'clean', blob: cleanVariant },
    { label: 'enhanced', blob: enhancedVariant },
  ];
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
  const pretaxAmount = extractPretaxAmount(lines);
  const taxBreakdown = extractTaxBreakdown(lines);
  const taxAmount = extractTaxAmount(lines, taxBreakdown);
  const amountFromLabels = extractBestTotalAmount(lines)
    ?? extractSectionAmount(lines, RECEIPT_TOTAL_PATTERNS);
  const fallbackAmounts = lines
    .filter((line) => {
      const normalizedLine = normalizeForMatching(line);
      return /total|amount|price|pay|due|balance|subtotal|tax|vat|net|grand/i.test(normalizedLine);
    })
    .flatMap((line) => extractAmounts(line, { allowLooseIntegers: true }));

  let amount = amountFromLabels
    ?? (fallbackAmounts.length > 0 ? Math.max(...fallbackAmounts) : undefined);

  let resolvedSubtotal = subtotal;
  let resolvedTaxAmount = taxAmount;

  if (!resolvedSubtotal && pretaxAmount && (!amount || pretaxAmount < amount)) {
    resolvedSubtotal = pretaxAmount;
  }

  if (amount && resolvedTaxAmount && resolvedTaxAmount > amount * 0.35) {
    resolvedTaxAmount = undefined;
  }

  if (amount && resolvedSubtotal && resolvedSubtotal > amount * 1.2) {
    resolvedSubtotal = undefined;
  }

  if (!amount && resolvedSubtotal && resolvedTaxAmount) {
    amount = resolvedSubtotal + resolvedTaxAmount;
  }

  if (amount && resolvedSubtotal && !resolvedTaxAmount && amount > resolvedSubtotal) {
    const derivedTax = amount - resolvedSubtotal;
    if (derivedTax <= amount * 0.35) {
      resolvedTaxAmount = Number(derivedTax.toFixed(2));
    }
  }

  if (amount && resolvedTaxAmount && !resolvedSubtotal && amount > resolvedTaxAmount) {
    resolvedSubtotal = Number((amount - resolvedTaxAmount).toFixed(2));
  }

  if (amount && resolvedSubtotal && resolvedTaxAmount !== undefined) {
    const combined = Number((resolvedSubtotal + resolvedTaxAmount).toFixed(2));
    const variance = Math.abs(combined - amount);
    if (variance > Math.max(2, amount * 0.05) && amount > resolvedSubtotal) {
      const derivedTax = amount - resolvedSubtotal;
      if (derivedTax >= 0 && derivedTax <= amount * 0.35) {
        resolvedTaxAmount = Number(derivedTax.toFixed(2));
      }
    }
  }

  const date = extractDate(lines);
  const time = extractTime(lines);
  const paymentMethod = extractPaymentMethod(lines);
  const invoiceNumber = extractInvoiceNumber(lines);
  const items = extractItems(lines, amount);
  const currency = documentIntelligenceService.detectCurrency(rawText);
  const categoryHint = deriveCategoryHint(rawText, merchantName, items);
  const categoryPrediction = await documentIntelligenceService.predictCategory({
    merchantName,
    text: [merchantLine, ...items.map((item) => item.name), rawText].join(' '),
    amount,
    userId,
  });
  const resolvedCategory = categoryHint || categoryPrediction.category;
  const notes = resolvedCategory !== 'Others'
    ? `${resolvedCategory.toLowerCase()} receipt`
    : 'receipt import';
  const validationResult = buildValidationResult({
    amount,
    subtotal: resolvedSubtotal,
    taxAmount: resolvedTaxAmount,
    taxBreakdown,
    items,
  });

  return {
    merchantName,
    amount,
    date,
    time,
    currency,
    taxAmount: resolvedTaxAmount,
    taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
    subtotal: resolvedSubtotal,
    paymentMethod,
    invoiceNumber,
    category: resolvedCategory,
    subcategory: (items[0]?.name && items[0].name.length >= 3 && /[a-z]{2,}/i.test(items[0].name))
      ? items[0].name
      : '',
    notes,
    items,
    validationResult,
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
