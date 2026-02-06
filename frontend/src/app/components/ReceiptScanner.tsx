import React, { useState, useRef } from 'react';
import { Upload, Camera, X, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { useApp } from '@/contexts/AppContext';

interface ReceiptScanResult {
  merchantName?: string;
  amount?: number;
  date?: Date;
  category?: string;
  items?: Array<{ name: string; amount: number }>;
  confidence?: number;
}

interface ReceiptScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated?: (transactionId: number) => void;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  isOpen,
  onClose,
  onTransactionCreated,
}) => {
  const { accounts, currency } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setScanResult(null);
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return;
    }

    setIsScanning(true);
    try {
      // TODO: Integrate with actual OCR service
      // For now, simulate OCR with a placeholder
      const result = await simulateReceiptOCR(selectedFile);
      setScanResult(result);
      toast.success('Receipt scanned successfully');
    } catch (error) {
      console.error('Error scanning receipt:', error);
      toast.error('Failed to scan receipt. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const simulateReceiptOCR = async (file: File): Promise<ReceiptScanResult> => {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Placeholder: In production, integrate with Google Vision API, Azure Computer Vision, etc.
    return {
      merchantName: 'Sample Store',
      amount: 45.99,
      date: new Date(),
      category: 'Shopping',
      items: [
        { name: 'Item 1', amount: 25.99 },
        { name: 'Item 2', amount: 20.0 },
      ],
      confidence: 0.85,
    };
  };

  const handleCreateTransaction = async () => {
    if (!scanResult || !selectedAccountId) {
      toast.error('Please select an account and confirm the scanned data');
      return;
    }

    try {
      const transactionId = await db.transactions.add({
        type: 'expense',
        amount: scanResult.amount || 0,
        accountId: selectedAccountId,
        category: scanResult.category || 'Shopping',
        description: scanResult.merchantName || 'Receipt',
        date: scanResult.date || new Date(),
        merchant: scanResult.merchantName,
        updatedAt: new Date(),
      });

      // Show detailed success feedback
      const message = `📦 Expense ${currency} ${(scanResult.amount || 0).toFixed(2)} from ${scanResult.merchantName || 'Receipt'} added to ${scanResult.category || 'Shopping'}`;
      toast.success(message);
      onTransactionCreated?.(transactionId as number);
      handleClose();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('❌ Failed to create transaction. Please try again.');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setScanResult(null);
    setSelectedAccountId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Receipt Scanner</h2>
            <p className="text-sm text-gray-500 mt-1">Scan your receipt to auto-fill transaction details</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!previewUrl ? (
            // File Upload Section
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Upload size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">Upload Receipt</span>
                  <span className="text-xs text-gray-500 mt-1">JPG, PNG (Max 5MB)</span>
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Camera size={32} className="text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">Take Photo</span>
                  <span className="text-xs text-gray-500 mt-1">Use your camera</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : !scanResult ? (
            // Image Preview & Scan Button
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-80 object-cover rounded-lg"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPreviewUrl('');
                    setSelectedFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Change Image
                </button>

                <button
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    'Scan Receipt'
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Scan Results & Confirmation
            <div className="space-y-4">
              {/* Confidence Indicator */}
              {scanResult.confidence && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                  {scanResult.confidence >= 0.8 ? (
                    <CheckCircle2 className="text-green-600" size={20} />
                  ) : (
                    <AlertCircle className="text-yellow-600" size={20} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Confidence: {(scanResult.confidence * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-600">
                      {scanResult.confidence >= 0.8
                        ? 'High confidence in scanned data'
                        : 'Please review extracted information'}
                    </p>
                  </div>
                </div>
              )}

              {/* Scan Results */}
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
                  <input
                    type="text"
                    value={scanResult.merchantName || ''}
                    onChange={(e) =>
                      setScanResult({ ...scanResult, merchantName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="flex items-center">
                      <span className="text-gray-600 mr-2">{currency}</span>
                      <input
                        type="number"
                        value={scanResult.amount || ''}
                        onChange={(e) =>
                          setScanResult({ ...scanResult, amount: parseFloat(e.target.value) })
                        }
                        step="0.01"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={
                        scanResult.date
                          ? new Date(scanResult.date).toISOString().split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setScanResult({ ...scanResult, date: new Date(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={scanResult.category || ''}
                    onChange={(e) =>
                      setScanResult({ ...scanResult, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Dining">Dining</option>
                    <option value="Transport">Transport</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Health">Health</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {scanResult.items && scanResult.items.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                    <div className="space-y-2 bg-white p-3 rounded border border-gray-200">
                      {scanResult.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="text-gray-600">{item.name}</span>
                          <span className="font-medium text-gray-900">
                            {currency} {item.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account to charge *
                </label>
                <select
                  value={selectedAccountId || ''}
                  onChange={(e) => setSelectedAccountId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setPreviewUrl('');
                    setSelectedFile(null);
                    setScanResult(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleCreateTransaction}
                  disabled={!selectedAccountId}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-medium transition-colors"
                >
                  Create Transaction
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
