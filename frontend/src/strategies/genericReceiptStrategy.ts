import type { ReceiptScanResult } from '@/types/receipt.types';
import type { ParsingContext, ParsingStrategy } from '@/services/receiptParserService';
import { parseReceiptText } from '@/services/receiptScannerService';

export class GenericReceiptStrategy implements ParsingStrategy {
  name = 'Generic';

  confidence(_text: string): number {
    return 0.35;
  }

  async parse(text: string, context?: ParsingContext): Promise<Partial<ReceiptScanResult> | null> {
    try {
      const parsed = await parseReceiptText(text, context?.userId);
      return {
        ...parsed,
      };
    } catch (error) {
      console.error('Generic parser failed:', error);
      return null;
    }
  }
}
