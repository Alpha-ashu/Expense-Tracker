import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentManagementService } from '@/services/documentManagementService';
import { MerchantProfileService } from '@/services/merchantProfileService';
import { TransactionService } from '@/services/transactionService';
import type { ReceiptScanResult } from '@/types/receipt.types';

export const useTransactionCreation = () => {
  const { accounts, currency, refreshData } = useApp();
  const { user } = useAuth();

  const transactionService = useRef(new TransactionService());
  const merchantService = useRef(new MerchantProfileService());
  const documentService = useRef(new DocumentManagementService());

  const createTransaction = useCallback(async (
    scanResult: ReceiptScanResult,
    accountId: number,
    scanDocumentId?: number | null,
    onSuccess?: (transactionId: number) => void,
  ) => {
    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      toast.error('Selected account not found');
      return;
    }

    try {
      const result = await transactionService.current.createFromReceipt({
        scanResult,
        accountId,
        userId: user.id,
        currency,
        currentBalance: account.balance,
        onDuplicateNotify: () => {
          toast.warning('Potential duplicate detected. Please review before adding again.');
        },
      });

      if (!result.saved) {
        return;
      }

      await merchantService.current.upsertFromReceipt(
        scanResult.merchantName || 'Unknown Merchant',
        scanResult.category || 'Shopping',
        scanResult.confidence ?? 0.8,
        user.id,
        [scanResult.merchantName, scanResult.notes, scanResult.rawText].filter(Boolean).join(' '),
      );

      if (scanDocumentId && result.transactionId) {
        await documentService.current.linkTransaction(scanDocumentId, result.transactionId);
      }

      toast.success(`Expense of ${currency} ${scanResult.amount?.toFixed(2)} added to ${account.name}`);
      refreshData();

      if (result.transactionId) {
        onSuccess?.(result.transactionId);
      }
    } catch (error) {
      if (scanDocumentId) {
        await documentService.current.markAsFailed(scanDocumentId);
      }
      console.error('Failed to create transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add transaction');
    }
  }, [accounts, currency, refreshData, user]);

  return { createTransaction };
};
