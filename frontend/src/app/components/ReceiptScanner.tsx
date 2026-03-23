import React, { useEffect, useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReceiptScanner } from '@/hooks/useReceiptScanner';
import { useTransactionCreation } from '@/hooks/useTransactionCreation';
import { detectExpenseCategoryFromText, getExpenseCategoryNames } from '@/lib/expenseCategories';
import { SUPPORTED_RECEIPT_MIME_TYPES } from '@/services/receiptScannerService';
import type { ReceiptScannerProps } from '@/types/receipt.types';
import {
  FileSelectionView,
  PreviewView,
  ResultsView,
  type ScanFieldUpdater,
} from '@/app/components/receipt-scanner/ReceiptScannerViews';

export type { ReceiptScanPayload } from '@/types/receipt.types';

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  isOpen,
  onClose,
  onTransactionCreated,
  onApplyScan,
  expenseMode = 'individual',
  initialAccountId,
}) => {
  const { accounts, currency, setCurrentPage } = useApp();
  const { user } = useAuth();

  const {
    selectedFile,
    previewUrl,
    isScanning,
    scanProgress,
    scanStatus,
    scanResult,
    scanDocumentId,
    onDeviceOnly,
    setScanResult,
    selectFile,
    clearFile,
    scanReceipt,
    setOnDeviceOnly,
  } = useReceiptScanner();

  const { createTransaction } = useTransactionCreation();

  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    initialAccountId ?? accounts[0]?.id ?? null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const expenseCategoryOptions = getExpenseCategoryNames();
  const isFormPrefillMode = !!onApplyScan;

  useEffect(() => {
    if (isOpen) {
      setSelectedAccountId(initialAccountId ?? accounts[0]?.id ?? null);
    }
  }, [accounts, initialAccountId, isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_RECEIPT_MIME_TYPES.includes(file.type)) {
      toast.error('Supported files: JPG, PNG, PDF, HEIC, WEBP');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size must be under 15 MB');
      return;
    }

    selectFile(file);
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return;
    }

    const result = await scanReceipt(selectedAccountId ?? undefined, user?.id);

    // Show validation mismatch warning if AI detected a discrepancy
    if (result?.validationResult && !result.validationResult.isValid) {
      const { calculated, detected } = result.validationResult;
      toast.warning(
        `Bill total mismatch: calculated ${result.currency ?? ''} ${calculated.toFixed(2)} vs printed ${result.currency ?? ''} ${detected.toFixed(2)}. Please verify before saving.`,
        { duration: 8000 },
      );
    }
  };

  const handleCreateTransaction = async () => {
    if (!scanResult || !selectedAccountId) {
      toast.error('Please select an account to continue');
      return;
    }

    if (!scanResult.amount || scanResult.amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    await createTransaction(scanResult, selectedAccountId, scanDocumentId, (transactionId) => {
      onTransactionCreated?.(transactionId);
      handleClose();
      setCurrentPage('transactions');
    });
  };

  const handleApplyScanToForm = () => {
    if (!scanResult || !selectedAccountId) {
      toast.error('Please select an account to continue');
      return;
    }

    onApplyScan?.({
      ...scanResult,
      accountId: selectedAccountId,
    });

    toast.success(`Receipt applied to ${expenseMode === 'group' ? 'group' : 'individual'} expense form`);
    handleClose();
  };

  const handleClose = () => {
    clearFile();
    setSelectedAccountId(accounts[0]?.id ?? null);
    onClose();
  };

  const updateScanResultField: ScanFieldUpdater = (field, value) => {
    if (scanResult) {
      setScanResult({ ...scanResult, [field]: value });
    }
  };

  const handleSubcategoryChange = (value: string) => {
    if (!scanResult) return;
    // Only use the subcategory text itself for category detection — NOT the merchant name
    // to avoid the merchant name bleeding into the subcategory field
    const detected = value.trim().length >= 3
      ? detectExpenseCategoryFromText(value)
      : null;

    setScanResult({
      ...scanResult,
      subcategory: value,
      // Only update category if we confidently detected one from the subcategory text
      category: detected?.category ?? scanResult.category ?? 'Shopping',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black">
              <ScanLine size={17} className="text-white" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-gray-900">Receipt Scanner</h2>
              <p className="text-xs text-gray-400">AI-powered OCR - reads any receipt</p>
              {isFormPrefillMode && (
                <p className="mt-1 text-[11px] font-semibold text-gray-500">
                  Filling {expenseMode === 'group' ? 'group expense' : 'individual expense'} form
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!selectedFile && (
            <FileSelectionView
              onFileSelect={handleFileSelect}
              onCameraClick={() => cameraInputRef.current?.click()}
              onUploadClick={() => fileInputRef.current?.click()}
              onDeviceOnly={onDeviceOnly}
              onDeviceOnlyChange={setOnDeviceOnly}
            />
          )}

          {selectedFile && !scanResult && (
            <PreviewView
              file={selectedFile}
              previewUrl={previewUrl}
              isScanning={isScanning}
              scanProgress={scanProgress}
              scanStatus={scanStatus}
              onScan={handleScanReceipt}
              onChange={clearFile}
            />
          )}

          {scanResult && (
            <ResultsView
              scanResult={scanResult}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              currency={currency}
              expenseCategoryOptions={expenseCategoryOptions}
              isFormPrefillMode={isFormPrefillMode}
              expenseMode={expenseMode}
              onAccountChange={setSelectedAccountId}
              onFieldChange={updateScanResultField}
              onSubcategoryChange={handleSubcategoryChange}
              onRescan={() => {
                setScanResult(null);
                clearFile();
              }}
              onSubmit={isFormPrefillMode ? handleApplyScanToForm : handleCreateTransaction}
            />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.heic,.heif,.webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload receipt"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Take photo"
      />
    </div>
  );
};
