import type { ReceiptScanResult } from '@/types/receipt.types';
import { GenericReceiptStrategy } from '../strategies/genericReceiptStrategy';
import { IndianRestaurantStrategy } from '../strategies/indianRestaurantStrategy';
import { OnlinePaymentStrategy } from '../strategies/onlinePaymentStrategy';
import { RetailReceiptStrategy } from '../strategies/retailReceiptStrategy';
import { SupermarketStrategy } from '../strategies/supermarketStrategy';

export interface ParsingContext {
  userId?: string;
}

export interface ParsingStrategy {
  name: string;
  parse(text: string, context?: ParsingContext): Promise<Partial<ReceiptScanResult> | null> | Partial<ReceiptScanResult> | null;
  confidence(text: string): number;
}

interface StrategyAttempt {
  strategyName: string;
  confidence: number;
  result: Partial<ReceiptScanResult> | null;
}

const hasMeaningfulValue = (result: Partial<ReceiptScanResult> | null) => {
  if (!result) return false;
  return Boolean(
    result.amount && result.amount > 0
    || result.merchantName
    || result.date
    || result.taxAmount !== undefined
    || result.subtotal !== undefined
    || result.paymentMethod
    || result.invoiceNumber
    || (result.items && result.items.length > 0),
  );
};

const clampConfidence = (value: number) => Math.min(1, Math.max(0, value));

const mergeResultField = (
  target: ReceiptScanResult,
  source: Partial<ReceiptScanResult>,
  key: keyof ReceiptScanResult,
) => {
  if (source[key] === undefined || source[key] === null) return;
  if (target[key] === undefined || target[key] === null || target[key] === '') {
    target[key] = source[key] as never;
  }
};

const calculateCompleteness = (result: ReceiptScanResult) => {
  let score = 0;
  if (result.merchantName) score += 0.2;
  if (result.amount && result.amount > 0) score += 0.3;
  if (result.date) score += 0.2;
  if (result.invoiceNumber) score += 0.1;
  if (result.items && result.items.length > 0) score += 0.2;
  return clampConfidence(score);
};

export class ReceiptParserService {
  private strategies: ParsingStrategy[] = [];

  constructor() {
    this.registerDefaultStrategies();
  }

  registerStrategy(strategy: ParsingStrategy) {
    this.strategies.push(strategy);
  }

  async parseReceipt(text: string, context?: ParsingContext): Promise<ReceiptScanResult> {
    const attempts: StrategyAttempt[] = await Promise.all(this.strategies.map(async (strategy) => {
      const confidence = clampConfidence(strategy.confidence(text));
      if (confidence <= 0.2) {
        return { strategyName: strategy.name, confidence: 0, result: null };
      }

      try {
        const parsed = await Promise.resolve(strategy.parse(text, context));
        return { strategyName: strategy.name, confidence, result: parsed };
      } catch (error) {
        console.warn(`Receipt strategy failed: ${strategy.name}`, error);
        return { strategyName: strategy.name, confidence: 0, result: null };
      }
    }));

    const valid = attempts
      .filter((item) => hasMeaningfulValue(item.result))
      .sort((a, b) => b.confidence - a.confidence);

    if (valid.length === 0) {
      throw new Error('Could not parse receipt - unknown format');
    }

    const finalResult: ReceiptScanResult = {
      rawText: text,
      confidence: valid[0].confidence,
    };

    for (const item of valid) {
      const result = item.result as Partial<ReceiptScanResult>;

      mergeResultField(finalResult, result, 'merchantName');
      mergeResultField(finalResult, result, 'date');
      mergeResultField(finalResult, result, 'time');
      mergeResultField(finalResult, result, 'currency');
      mergeResultField(finalResult, result, 'location');
      mergeResultField(finalResult, result, 'paymentMethod');
      mergeResultField(finalResult, result, 'invoiceNumber');
      mergeResultField(finalResult, result, 'category');
      mergeResultField(finalResult, result, 'subcategory');
      mergeResultField(finalResult, result, 'notes');
      mergeResultField(finalResult, result, 'description');
      mergeResultField(finalResult, result, 'items');
      mergeResultField(finalResult, result, 'taxBreakdown');
      mergeResultField(finalResult, result, 'validationResult');

      if ((!finalResult.amount || finalResult.amount <= 0) && result.amount && result.amount > 0) {
        finalResult.amount = result.amount;
      }

      if ((!finalResult.subtotal || finalResult.subtotal <= 0) && result.subtotal && result.subtotal > 0) {
        finalResult.subtotal = result.subtotal;
      }

      if ((!finalResult.taxAmount || finalResult.taxAmount < 0) && result.taxAmount !== undefined && result.taxAmount >= 0) {
        finalResult.taxAmount = result.taxAmount;
      }
    }

    if ((!finalResult.amount || finalResult.amount <= 0) && finalResult.subtotal && finalResult.subtotal > 0) {
      finalResult.amount = Number((finalResult.subtotal + (finalResult.taxAmount || 0)).toFixed(2));
    }

    if ((!finalResult.subtotal || finalResult.subtotal <= 0) && finalResult.amount && finalResult.taxAmount !== undefined) {
      const subtotal = finalResult.amount - finalResult.taxAmount;
      if (subtotal > 0) {
        finalResult.subtotal = Number(subtotal.toFixed(2));
      }
    }

    const averageStrategyConfidence = valid.reduce((sum, item) => sum + item.confidence, 0) / valid.length;
    const completenessConfidence = calculateCompleteness(finalResult);
    finalResult.confidence = clampConfidence((averageStrategyConfidence * 0.6) + (completenessConfidence * 0.4));

    return finalResult;
  }

  private registerDefaultStrategies() {
    this.registerStrategy(new IndianRestaurantStrategy());
    this.registerStrategy(new RetailReceiptStrategy());
    this.registerStrategy(new SupermarketStrategy());
    this.registerStrategy(new OnlinePaymentStrategy());
    this.registerStrategy(new GenericReceiptStrategy());
  }
}

export const receiptParserService = new ReceiptParserService();
