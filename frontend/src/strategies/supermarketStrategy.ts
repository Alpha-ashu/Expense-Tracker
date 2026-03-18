import type { ReceiptScanResult } from '@/types/receipt.types';
import type { ParsingContext, ParsingStrategy } from '@/services/receiptParserService';

export class SupermarketStrategy implements ParsingStrategy {
  name = 'Supermarket';

  confidence(text: string): number {
    let score = 0;
    if (/supermarket|grocery|hypermarket|mart/i.test(text)) score += 0.3;
    if (/qty|quantity|mrp|rate|discount|item/i.test(text)) score += 0.25;
    if (/sub\s*total|grand\s*total|tax/i.test(text)) score += 0.25;
    return Math.min(score, 1);
  }

  parse(text: string, _context?: ParsingContext): Partial<ReceiptScanResult> | null {
    const result: Partial<ReceiptScanResult> = {};
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (lines[0]) result.merchantName = lines[0];

    const subtotalMatch = text.match(/sub\s*total\s*:?\s*[₹$]?[\s]*(\d+\.?\d*)/i);
    const totalMatch = text.match(/grand\s*total\s*:?\s*[₹$]?[\s]*(\d+\.?\d*)/i)
      || text.match(/total\s*:?\s*[₹$]?[\s]*(\d+\.?\d*)/i);

    if (subtotalMatch?.[1]) result.subtotal = Number.parseFloat(subtotalMatch[1]);
    if (totalMatch?.[1]) result.amount = Number.parseFloat(totalMatch[1]);

    if (result.amount && result.subtotal && result.amount > result.subtotal) {
      result.taxAmount = Number((result.amount - result.subtotal).toFixed(2));
    }

    result.category = 'Groceries';
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  private calculateConfidence(result: Partial<ReceiptScanResult>) {
    let score = 0;
    if (result.merchantName) score += 0.3;
    if (result.subtotal && result.subtotal > 0) score += 0.3;
    if (result.amount && result.amount > 0) score += 0.4;
    return Math.min(score, 1);
  }
}
