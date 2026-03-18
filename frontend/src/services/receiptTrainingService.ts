import type { ReceiptScanResult } from '@/types/receipt.types';

export interface TrainingExample {
  receiptText: string;
  expectedResult: ReceiptScanResult;
  merchantType: string;
}

export class ReceiptTrainingService {
  private trainingExamples: TrainingExample[] = [];

  constructor() {
    this.loadDefaultExamples();
  }

  addExample(example: TrainingExample) {
    this.trainingExamples.push(example);
  }

  async improveParsing(text: string): Promise<Partial<ReceiptScanResult>> {
    const similarReceipts = this.findSimilarReceipts(text);
    if (similarReceipts.length === 0) {
      return {};
    }

    const patterns = this.extractPatterns(similarReceipts);
    return this.applyPatterns(text, patterns);
  }

  private findSimilarReceipts(text: string): TrainingExample[] {
    const keywords = this.extractKeywords(text);

    return this.trainingExamples
      .map((example) => ({
        example,
        score: this.calculateSimilarity(keywords, example.receiptText),
      }))
      .filter((item) => item.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.example);
  }

  private extractKeywords(text: string): Set<string> {
    const words = text.toLowerCase().split(/\W+/);
    return new Set(words.filter((word) => word.length > 3));
  }

  private calculateSimilarity(keywords: Set<string>, text: string): number {
    const textKeywords = this.extractKeywords(text);
    const intersection = new Set([...keywords].filter((keyword) => textKeywords.has(keyword)));
    return intersection.size / Math.max(keywords.size, textKeywords.size, 1);
  }

  private extractPatterns(examples: TrainingExample[]) {
    const merchantNames = examples.map((example) => example.expectedResult.merchantName || '').filter(Boolean);

    return {
      merchantPrefix: merchantNames.length > 0 ? merchantNames[0] : '',
      categoryHint: examples[0]?.expectedResult.category,
    };
  }

  private applyPatterns(text: string, patterns: { merchantPrefix?: string; categoryHint?: string }): Partial<ReceiptScanResult> {
    const result: Partial<ReceiptScanResult> = {};

    if (patterns.merchantPrefix && text.toLowerCase().includes(patterns.merchantPrefix.toLowerCase())) {
      result.merchantName = patterns.merchantPrefix;
    }

    if (patterns.categoryHint) {
      result.category = patterns.categoryHint;
    }

    return result;
  }

  private loadDefaultExamples() {
    this.trainingExamples.push({
      receiptText: 'CARAVAN MENU ...',
      expectedResult: {
        merchantName: 'CARAVAN MENU',
        amount: 10949,
        date: new Date(2024, 11, 30),
        invoiceNumber: '12627',
        subtotal: 10428,
        taxAmount: 521.4,
        items: [
          { name: 'SPICY MANGO LA', amount: 438 },
          { name: 'STRAWBERRY & BASIL MOJITO', amount: 209 },
          { name: 'KAALA KHATTA CHATPATTA', amount: 657 },
        ],
        category: 'Food & Dining',
        paymentMethod: 'Card',
        confidence: 0.95,
        rawText: 'CARAVAN MENU ...',
      },
      merchantType: 'restaurant',
    });
  }
}
