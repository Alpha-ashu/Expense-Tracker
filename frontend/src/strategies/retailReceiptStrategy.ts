import type { ReceiptScanResult } from '@/types/receipt.types';
import type { ParsingContext, ParsingStrategy } from '@/services/receiptParserService';

export class RetailReceiptStrategy implements ParsingStrategy {
  name = 'Retail';

  confidence(text: string): number {
    let score = 0;
    if (/store|shop|retail|mart/i.test(text)) score += 0.2;
    if (/item|qty|price|total/i.test(text)) score += 0.3;
    if (/\$\s*\d+\.\d{2}|\b\d+\.\d{2}\b/.test(text)) score += 0.2;
    return Math.min(score, 1);
  }

  parse(text: string, _context?: ParsingContext): Partial<ReceiptScanResult> | null {
    const result: Partial<ReceiptScanResult> = {};
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    const totalMatch = text.match(/total\s*:?\s*\$?\s*(\d+\.\d{2})/i)
      || text.match(/\$\s*(\d+\.\d{2})\s*$/m)
      || text.match(/grand\s*total\s*:?\s*(\d+\.\d{2})/i);

    if (totalMatch?.[1]) {
      result.amount = Number.parseFloat(totalMatch[1]);
    }

    if (lines[0]) {
      result.merchantName = lines[0];
    }

    result.category = 'Shopping';
    result.confidence = this.calculateConfidence(result);

    return result;
  }

  private calculateConfidence(result: Partial<ReceiptScanResult>) {
    let score = 0;
    if (result.merchantName) score += 0.4;
    if (result.amount && result.amount > 0) score += 0.6;
    return Math.min(score, 1);
  }
}
