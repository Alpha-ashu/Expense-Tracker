import { db } from '@/lib/database';
import { financialDataCaptureService } from './financialDataCaptureService';
import type { ReceiptScanResult } from '@/types/receipt.types';

export interface CreateTransactionParams {
  scanResult: ReceiptScanResult;
  accountId: number;
  userId: string;
  currency: string;
  currentBalance: number;
  onDuplicateNotify?: () => void;
}

export class TransactionService {
  async createFromReceipt(
    params: CreateTransactionParams,
  ): Promise<{ transactionId?: number; saved: boolean; duplicate: boolean; message: string }> {
    const {
      scanResult,
      accountId,
      userId,
      currency,
      currentBalance,
      onDuplicateNotify,
    } = params;

    const amount = scanResult.amount || 0;
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // Build smart description: AI-generated > notes > merchant name
    const baseDescription = scanResult.description?.trim()
      || scanResult.notes?.trim()
      || scanResult.merchantName
      || 'Receipt';

    // Embed tax amount in description for Tax Tracker reads (format: tax:<amount>)
    const taxSuffix = scanResult.taxAmount && scanResult.taxAmount > 0
      ? ` tax:${scanResult.taxAmount.toFixed(2)}`
      : '';

    const savedTransaction = await financialDataCaptureService.saveTransactionDraft(
      {
        type: 'expense',
        amount,
        accountId,
        category: scanResult.category || 'Shopping',
        subcategory: scanResult.subcategory?.trim() || '',
        description: `${baseDescription}${taxSuffix}`,
        merchant: scanResult.merchantName || '',
        date: scanResult.date || new Date(),
        importSource: 'receipt-scanner',
        importMetadata: {
          Currency: scanResult.currency || currency,
          'Invoice Number': scanResult.invoiceNumber || '',
          'Payment Method': scanResult.paymentMethod || '',
          'OCR Confidence': scanResult.confidence?.toString() || '',
          'Tax Amount': scanResult.taxAmount?.toFixed(2) || '',
          'Subtotal': scanResult.subtotal?.toFixed(2) || '',
          'Location': scanResult.location || '',
        },
      },
      {
        userId,
        duplicateDecision: 'notify',
        onDuplicateNotify: onDuplicateNotify || (() => {}),
      },
    );

    if (savedTransaction.saved && savedTransaction.transactionId) {
      await this.updateAccountBalance(accountId, currentBalance - amount);
    }

    return savedTransaction;
  }

  private async updateAccountBalance(accountId: number, newBalance: number): Promise<void> {
    await db.accounts.update(accountId, {
      balance: newBalance,
      updatedAt: new Date(),
    });
  }
}
