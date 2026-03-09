import React, { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { Upload, Camera, X, CheckCircle2, AlertCircle, Loader, ScanLine, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/database';
import { saveTransactionWithBackendSync } from '@/lib/auth-sync-integration';
import { useApp } from '@/contexts/AppContext';
import {
  detectExpenseCategoryFromText,
  getExpenseCategoryNames,
  normalizeCategorySelection,
} from '@/lib/expenseCategories';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   Receipt scan result
───────────────────────────────────────────────────────────── */
export interface ReceiptScanResult {
  merchantName?: string;
  amount?: number;
  date?: Date;
  category?: string;
  subcategory?: string;
  items?: Array<{ name: string; amount: number }>;
  confidence?: number;
  rawText?: string;
}

export interface ReceiptScanPayload extends ReceiptScanResult {
  accountId: number;
}

interface ReceiptScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated?: (transactionId: number) => void;
  onApplyScan?: (scan: ReceiptScanPayload) => void;
  expenseMode?: 'individual' | 'group';
  initialAccountId?: number | null;
}

/* ─────────────────────────────────────────────────────────────
   Smart receipt text parser
   Priority order for "total":
     Grand Total > Net Total > Food Total > Bill Total > Total
   Skips taxes (CGST, SGST, VAT, Service Charge) and subtotals.
───────────────────────────────────────────────────────────── */
const SKIP_KEYWORDS = /cgst|sgst|vat|service charge|service tax|discount|sub.?total|subtotal|tip|gratuity|rounding/i;

function parseReceiptText(rawText: string): ReceiptScanResult {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  /* ── 1. Merchant name: first 1-3 non-trivial lines ── */
  const skipLinePatterns = /date|time|invoice|bill no|tax|t\.no|table|gstin|fssai|vat|www\.|phone|tel:|address/i;
  const merchantLines = lines.slice(0, 8).filter(l => {
    return l.length > 2 && !/^\d/.test(l) && !skipLinePatterns.test(l);
  });
  const merchantName = merchantLines[0] || '';

  /* ── 2. Date extraction ── */
  let date: Date | undefined;
  const datePatterns = [
    /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/,   // DD/MM/YY or DD-MM-YYYY
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{2,4})/i,
  ];
  for (const line of lines) {
    for (const pat of datePatterns) {
      const m = line.match(pat);
      if (m) {
        try {
          if (pat.source.includes('jan')) {
            date = new Date(`${m[1]} ${m[2]} ${m[3]}`);
          } else {
            // DD/MM/YY or DD/MM/YYYY
            let year = parseInt(m[3]);
            if (year < 100) year += 2000;
            date = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
          }
          if (!isNaN(date.getTime())) break;
        } catch { /* ignore */ }
      }
    }
    if (date) break;
  }

  /* ── 3. Amount extraction — priority-ordered total keywords ── */
  const totalTierKeywords: RegExp[][] = [
    // Tier 1: explicit grand/net/food/bill totals
    [/grand\s*total/i, /net\s*total/i, /net\s*amount/i, /food\s*total/i, /bill\s*total/i, /amount\s*due/i, /balance\s*due/i],
    // Tier 2: plain "Total" keyword (but not subtotal)
    [/^total\s*[:\|]/i, /\btotal\s*[:\|]/i],
    // Tier 3: fallback — any line containing "total" that isn't a skip keyword
    [/total/i],
  ];

  let totalAmount = 0;

  tierLoop:
  for (const tier of totalTierKeywords) {
    for (const pattern of tier) {
      for (const line of lines) {
        if (!pattern.test(line)) continue;
        if (SKIP_KEYWORDS.test(line)) continue;

        // Extract all numeric values from the line
        const nums = extractAmounts(line);
        if (nums.length === 0) continue;

        // Take the LARGEST number on this line (avoids item counts / qty)
        const candidate = Math.max(...nums);
        if (candidate > totalAmount) totalAmount = candidate;
      }
    }
    if (totalAmount > 0) break tierLoop;
  }

  // Last resort: scan all lines for largest numeric value
  if (totalAmount === 0) {
    for (const line of lines) {
      if (SKIP_KEYWORDS.test(line)) continue;
      const nums = extractAmounts(line);
      for (const n of nums) {
        if (n > totalAmount) totalAmount = n;
      }
    }
  }

  /* ── 4. Line items (Particulars section) ── */
  const items: Array<{ name: string; amount: number }> = [];
  let inParticulars = false;
  for (const line of lines) {
    if (/particulars|description|item/i.test(line)) { inParticulars = true; continue; }
    if (/total|sub.*total|amount due/i.test(line) && inParticulars) break;
    if (inParticulars) {
      const nums = extractAmounts(line);
      if (nums.length > 0) {
        const amount = Math.max(...nums);
        // strip numbers from end to get name
        const name = line.replace(/[\d,\.\s]+$/, '').trim();
        if (name.length > 1) items.push({ name, amount });
      }
    }
  }

  /* ── 5. Category + subcategory detection ── */
  const detectionText = [merchantName, ...items.map((item) => item.name), rawText]
    .filter(Boolean)
    .join(' ')
    .trim();
  const detectedExpense = detectExpenseCategoryFromText(detectionText);
  const category = detectedExpense?.category ?? 'Shopping';
  const subcategory = detectedExpense?.subcategory ?? '';

  /* ── 6. Confidence: higher when we reliably matched total keywords ── */
  const confidence = totalAmount > 0 ? (items.length > 0 ? 0.92 : 0.75) : 0.4;

  return { merchantName, amount: totalAmount, date, category, subcategory, items, confidence, rawText };
}

/** Extract all numeric amounts from a string, handling commas and decimals */
function extractAmounts(text: string): number[] {
  // Match patterns like: 10,949.40  10949  ₹1049  Rs.45.99
  const matches = text.match(/(?:rs\.?|₹|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi) || [];
  return matches
    .map(m => parseFloat(m.replace(/[^0-9.]/g, '')))
    .filter(n => !isNaN(n) && n > 0 && n < 10_000_000); // sanity upper bound
}

/* ─────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────── */
export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  isOpen,
  onClose,
  onTransactionCreated,
  onApplyScan,
  expenseMode = 'individual',
  initialAccountId,
}) => {
  const { accounts, currency, refreshData, setCurrentPage } = useApp();
  const expenseCategoryOptions = getExpenseCategoryNames();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    initialAccountId ?? accounts[0]?.id ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isFormPrefillMode = !!onApplyScan;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAccountId(initialAccountId ?? accounts[0]?.id ?? null);
  }, [accounts, initialAccountId, isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('File size must be under 15 MB'); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScanResult(null);
    setScanProgress(0);
    setScanStatus('');
  };

  const handleScanReceipt = async () => {
    if (!selectedFile) { toast.error('Please select an image first'); return; }
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Initialising OCR engine…');

    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.round((m.progress ?? 0) * 100));
            setScanStatus(`Reading text… ${Math.round((m.progress ?? 0) * 100)}%`);
          } else if (m.status) {
            setScanStatus(m.status.charAt(0).toUpperCase() + m.status.slice(1) + '…');
          }
        },
      });

      setScanStatus('Analysing receipt…');
      const { data } = await worker.recognize(selectedFile);
      await worker.terminate();

      const rawText = data.text;
      const result = parseReceiptText(rawText);
      setScanResult(result);

      if (result.amount && result.amount > 0) {
        toast.success(`✅ Found total: ${currency} ${result.amount.toFixed(2)}`);
      } else {
        toast.warning('⚠️ Could not detect total amount — please enter manually');
      }
    } catch (err) {
      console.error('OCR error:', err);
      toast.error('Scan failed. Try a clearer image or enter details manually.');
    } finally {
      setIsScanning(false);
      setScanProgress(100);
    }
  };

  const handleCreateTransaction = async () => {
    if (!scanResult || !selectedAccountId) {
      toast.error('Select an account to continue');
      return;
    }
    const amount = scanResult.amount || 0;
    if (amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) {
      toast.error('Selected account not found');
      return;
    }
    try {
      const category = normalizeCategorySelection(scanResult.category || 'Shopping', 'expense');
      const subcategory = scanResult.subcategory?.trim() || '';

      // Save transaction (syncs to backend if online)
      const savedTransaction = await saveTransactionWithBackendSync({
        type: 'expense',
        amount,
        accountId: selectedAccountId,
        category,
        subcategory,
        description: scanResult.merchantName || 'Receipt',
        merchant: scanResult.merchantName || '',
        date: scanResult.date || new Date(),
        tags: [],
      });

      // Update account balance
      const newBalance = account.balance - amount;
      await db.accounts.update(selectedAccountId, { balance: newBalance, updatedAt: new Date() });

      toast.success(`📦 Expense of ${currency} ${amount.toFixed(2)} added to ${account.name}`);
      refreshData();
      if (savedTransaction?.id) {
        onTransactionCreated?.(savedTransaction.id);
      }
      handleClose();
      // Navigate back to transactions
      setCurrentPage('transactions');
    } catch (err) {
      console.error('Failed to save scanned transaction:', err);
      toast.error('Failed to add transaction. Please try again.');
    }
  };

  const handleApplyScanToForm = () => {
    if (!scanResult || !selectedAccountId) {
      toast.error('Select an account to continue');
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
    setSelectedFile(null);
    setPreviewUrl('');
    setScanResult(null);
    setSelectedAccountId(accounts[0]?.id ?? null);
    setScanProgress(0);
    setScanStatus('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
              <ScanLine size={17} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-gray-900 text-base">Receipt Scanner</h2>
              <p className="text-xs text-gray-400">AI-powered OCR — reads any receipt</p>
              {isFormPrefillMode && (
                <p className="mt-1 text-[11px] font-semibold text-gray-500">
                  Filling {expenseMode === 'group' ? 'group expense' : 'individual expense'} form
                </p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* ── Step 1: Choose image ── */}
          {!previewUrl && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Choose a receipt image</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <Upload size={22} className="text-gray-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-800">Upload Image</p>
                    <p className="text-xs text-gray-400">JPG, PNG, WebP</p>
                  </div>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-black group-hover:bg-gray-800 flex items-center justify-center transition-colors">
                    <Camera size={22} className="text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-800">Take Photo</p>
                    <p className="text-xs text-gray-400">Use camera</p>
                  </div>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" aria-label="Upload receipt" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" aria-label="Take photo" />

              <div className="bg-blue-50 rounded-2xl p-4">
                <p className="text-xs text-blue-700 font-semibold">💡 Tips for best results</p>
                <ul className="text-xs text-blue-600 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Ensure receipt is flat and well-lit</li>
                  <li>Capture the entire receipt including the total</li>
                  <li>Avoid blurry or dark images</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview + Scan ── */}
          {previewUrl && !scanResult && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={previewUrl} alt="Receipt preview" className="w-full max-h-72 object-contain bg-gray-50" />
                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    <p className="text-white font-semibold text-sm">{scanStatus}</p>
                    <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-white/70 text-xs">{scanProgress}%</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setPreviewUrl(''); setSelectedFile(null); }}
                  disabled={isScanning}
                  className="flex-[0.4] flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={14} /> Change
                </button>
                <button
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-40 shadow-lg"
                >
                  {isScanning
                    ? <><Loader size={16} className="animate-spin" /> Scanning…</>
                    : <><ScanLine size={16} /> Scan Receipt</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review results ── */}
          {scanResult && (
            <div className="space-y-4">
              {/* Confidence badge */}
              <div className={cn(
                'flex items-center gap-3 p-3.5 rounded-2xl',
                (scanResult.confidence ?? 0) >= 0.8 ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
              )}>
                {(scanResult.confidence ?? 0) >= 0.8
                  ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  : <AlertCircle size={18} className="text-amber-600 shrink-0" />
                }
                <div>
                  <p className={cn('text-sm font-bold', (scanResult.confidence ?? 0) >= 0.8 ? 'text-emerald-800' : 'text-amber-800')}>
                    {(scanResult.confidence ?? 0) >= 0.8 ? 'High confidence scan' : 'Please review the extracted data'}
                  </p>
                  <p className={cn('text-xs', (scanResult.confidence ?? 0) >= 0.8 ? 'text-emerald-600' : 'text-amber-600')}>
                    Confidence: {((scanResult.confidence ?? 0) * 100).toFixed(0)}% — edit any field if needed
                  </p>
                </div>
              </div>

              {/* Extracted fields */}
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden border border-gray-200">
                {/* Amount — highlighted */}
                <div className="p-4">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Total Amount *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm font-bold">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={scanResult.amount || ''}
                      onChange={e => setScanResult({ ...scanResult, amount: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-transparent text-2xl font-display font-bold text-gray-900 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="p-4">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Merchant</label>
                  <input
                    type="text"
                    value={scanResult.merchantName || ''}
                    onChange={e => setScanResult({ ...scanResult, merchantName: e.target.value })}
                    className="w-full bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                    placeholder="Merchant name"
                  />
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="p-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date</label>
                    <input
                      type="date"
                      value={scanResult.date ? new Date(scanResult.date).toISOString().split('T')[0] : ''}
                      onChange={e => setScanResult({ ...scanResult, date: new Date(e.target.value) })}
                      className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div className="p-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Category</label>
                    <select
                      value={scanResult.category || ''}
                      onChange={e => setScanResult({ ...scanResult, category: normalizeCategorySelection(e.target.value, 'expense') })}
                      className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none appearance-none"
                    >
                      {expenseCategoryOptions.map(c =>
                        <option key={c} value={c}>{c}</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="p-4">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={scanResult.subcategory || ''}
                    onChange={e => {
                      const nextSubcategory = e.target.value;
                      const detected = detectExpenseCategoryFromText(
                        [nextSubcategory, scanResult.merchantName, scanResult.rawText]
                          .filter(Boolean)
                          .join(' '),
                      );

                      setScanResult({
                        ...scanResult,
                        subcategory: nextSubcategory,
                        category: detected?.category ?? scanResult.category ?? 'Shopping',
                      });
                    }}
                    className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
                    placeholder="Groceries, Fuel / Petrol, Netflix, Uber Ride..."
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Edit this if the scan found the wrong expense type. The main category updates automatically.
                  </p>
                </div>

                {/* Detected items */}
                {scanResult.items && scanResult.items.length > 0 && (
                  <div className="p-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Detected Items ({scanResult.items.length})</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {scanResult.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-600 truncate mr-4">{item.name}</span>
                          <span className="font-semibold text-gray-900 shrink-0">{currency} {item.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Account selector */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Charge to Account *</label>
                <select
                  value={selectedAccountId || ''}
                  onChange={e => setSelectedAccountId(parseInt(e.target.value))}
                  className="w-full text-sm font-semibold text-gray-900 focus:outline-none appearance-none bg-transparent"
                >
                  <option value="">Select an account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({currency} {a.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setScanResult(null); setPreviewUrl(''); setSelectedFile(null); }}
                  className="flex-[0.4] flex items-center justify-center gap-1.5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw size={13} /> Rescan
                </button>
                <button
                  onClick={isFormPrefillMode ? handleApplyScanToForm : handleCreateTransaction}
                  disabled={!selectedAccountId || !scanResult.amount}
                  className="flex-1 py-3 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-900 disabled:opacity-40 transition-colors shadow-lg"
                >
                  {isFormPrefillMode
                    ? `Use in ${expenseMode === 'group' ? 'Group' : 'Individual'} Expense`
                    : 'Add Transaction'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
