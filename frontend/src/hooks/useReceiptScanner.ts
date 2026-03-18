import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DocumentManagementService } from '@/services/documentManagementService';
import { EnhancedReceiptScannerService } from '@/services/enhancedReceiptScannerService';
import { cloudReceiptScanService } from '@/services/cloudReceiptScanService';
import type { ReceiptScanResult } from '@/types/receipt.types';

const RECEIPT_OCR_ON_DEVICE_ONLY_KEY = 'receipt_scanner_on_device_only';

export const useReceiptScanner = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<number | null>(null);

  const [onDeviceOnly, setOnDeviceOnly] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(RECEIPT_OCR_ON_DEVICE_ONLY_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const ocrService = useRef(new EnhancedReceiptScannerService());
  const documentService = useRef(new DocumentManagementService());
  const cloudOcrService = useRef(cloudReceiptScanService);

  const updateOnDeviceOnly = useCallback((value: boolean) => {
    setOnDeviceOnly(value);
    try {
      localStorage.setItem(RECEIPT_OCR_ON_DEVICE_ONLY_KEY, String(value));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const selectFile = useCallback((file: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
    setScanResult(null);
    setScanProgress(0);
    setScanStatus('');
    setScanDocumentId(null);
  }, [previewUrl]);

  const clearFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setScanResult(null);
    setScanDocumentId(null);
    setScanProgress(0);
    setScanStatus('');
  }, [previewUrl]);

  const scanReceipt = useCallback(async (accountId?: number, userId?: string) => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return null;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Preparing receipt…');

    let documentId: number | null = null;

    try {
      documentId = await documentService.current.createDocumentRecord(selectedFile, accountId);
      setScanDocumentId(documentId);

      let result: ReceiptScanResult;

      if (!onDeviceOnly && selectedFile.type.startsWith('image/')) {
        try {
          result = await cloudOcrService.current.scanReceipt(selectedFile, (progress) => {
            setScanProgress(progress.progress);
            setScanStatus(progress.status);
          });
        } catch (cloudError) {
          console.warn('Cloud OCR scan failed, falling back to on-device OCR:', cloudError);
          toast.warning('Cloud scan failed. Switched to on-device OCR for this receipt.');
          result = await ocrService.current.scanAndParseReceipt(selectedFile, userId, (status, progress) => {
            setScanProgress(progress);
            setScanStatus(status);
          });
        }
      } else {
        if (!onDeviceOnly && !selectedFile.type.startsWith('image/')) {
          toast.info('Cloud scan currently supports image files. Using on-device OCR for this file.');
        }

        result = await ocrService.current.scanAndParseReceipt(selectedFile, userId, (status, progress) => {
          setScanProgress(progress);
          setScanStatus(status);
        });
      }

      await documentService.current.updateDocumentStatus(documentId, 'preview', {
        extractedCurrency: result.currency,
        metadata: {
          merchantName: result.merchantName || '',
          invoiceNumber: result.invoiceNumber || '',
          paymentMethod: result.paymentMethod || '',
        },
      });

      setScanResult(result);

      if (result.amount && result.amount > 0) {
        toast.success(`Found total: ${result.currency || 'USD'} ${result.amount.toFixed(2)}`);
      } else {
        toast.warning('Could not detect total amount. Please review before saving.');
      }

      return result;
    } catch (error) {
      if (documentId) {
        await documentService.current.markAsFailed(documentId);
      }
      toast.error(error instanceof Error ? error.message : 'Scan failed. Please try again.');
      return null;
    } finally {
      setIsScanning(false);
      setScanProgress(100);
    }
  }, [onDeviceOnly, selectedFile]);

  return {
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
    setOnDeviceOnly: updateOnDeviceOnly,
  };
};
