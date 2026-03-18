import React from 'react';
import { Upload, Camera, CheckCircle2, AlertCircle, Loader, ScanLine, RefreshCw } from 'lucide-react';
import { parseDateInputValue, toLocalDateKey } from '@/lib/dateUtils';
import { normalizeCategorySelection } from '@/lib/expenseCategories';
import { type Account } from '@/lib/database';
import { cn } from '@/lib/utils';
import type { ReceiptScanResult } from '@/types/receipt.types';

export type ScanFieldUpdater = <K extends keyof ReceiptScanResult>(
  field: K,
  value: ReceiptScanResult[K],
) => void;

export const FileSelectionView: React.FC<{
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadClick: () => void;
  onCameraClick: () => void;
  onDeviceOnly: boolean;
  onDeviceOnlyChange: (value: boolean) => void;
}> = ({ onUploadClick, onCameraClick, onDeviceOnly, onDeviceOnlyChange }) => (
  <div className="space-y-3">
    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Choose a receipt image</p>
    <div className="grid grid-cols-2 gap-3">
      <UploadButton onClick={onUploadClick} />
      <CameraButton onClick={onCameraClick} />
    </div>

    <PrivacyNotice onDeviceOnly={onDeviceOnly} onDeviceOnlyChange={onDeviceOnlyChange} />
  </div>
);

const UploadButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-6 transition-all hover:border-gray-400 hover:bg-gray-50"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 transition-colors group-hover:bg-gray-200">
      <Upload size={22} className="text-gray-600" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-gray-800">Upload Image</p>
      <p className="text-xs text-gray-400">JPG, PNG, PDF, HEIC, WebP</p>
    </div>
  </button>
);

const CameraButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-6 transition-all hover:border-gray-400 hover:bg-gray-50"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black transition-colors group-hover:bg-gray-800">
      <Camera size={22} className="text-white" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-gray-800">Take Photo</p>
      <p className="text-xs text-gray-400">Use camera</p>
    </div>
  </button>
);

const PrivacyNotice: React.FC<{
  onDeviceOnly: boolean;
  onDeviceOnlyChange: (value: boolean) => void;
}> = ({ onDeviceOnly, onDeviceOnlyChange }) => (
  <div className="rounded-2xl bg-blue-50 p-4">
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-white/80 px-3 py-2">
      <div>
        <p className="text-xs font-semibold text-blue-800">On-device OCR only</p>
        <p className="text-[11px] text-blue-700">
          {onDeviceOnly
            ? 'Enabled: receipt processing stays on this device.'
            : 'Disabled: image is sent securely to server OCR for improved accuracy.'}
        </p>
      </div>
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-blue-800">
        <input
          type="checkbox"
          checked={onDeviceOnly}
          onChange={(event) => onDeviceOnlyChange(event.target.checked)}
          className="h-4 w-4 rounded border-blue-300"
        />
        Enabled
      </label>
    </div>
    <p className="text-xs font-semibold text-blue-700">Tips for best results</p>
    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-blue-600">
      <li>Ensure receipt is flat and well-lit</li>
      <li>Capture the entire receipt including the total</li>
      <li>Avoid blurry or dark images</li>
    </ul>
    <p className="mt-2 text-[11px] text-blue-700">
      Privacy note: You can keep OCR local or use secure server OCR. Results are always shown for manual confirmation before saving.
    </p>
  </div>
);

export const PreviewView: React.FC<{
  file: File;
  previewUrl: string;
  isScanning: boolean;
  scanProgress: number;
  scanStatus: string;
  onScan: () => void;
  onChange: () => void;
}> = ({ file, previewUrl, isScanning, scanProgress, scanStatus, onScan, onChange }) => (
  <div className="space-y-4">
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      {previewUrl ? (
        <img src={previewUrl} alt="Receipt preview" className="max-h-72 w-full bg-gray-50 object-contain" />
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center bg-gray-50 px-6 text-center">
          <ScanLine size={28} className="mb-3 text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">{file.name}</p>
          <p className="mt-1 text-xs text-gray-500">PDF statement rendering will be optimized before OCR.</p>
        </div>
      )}
      {isScanning && <ScanningOverlay progress={scanProgress} status={scanStatus} />}
    </div>

    <div className="flex gap-3">
      <button
        onClick={onChange}
        disabled={isScanning}
        className="flex-[0.4] flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
      >
        <RefreshCw size={14} /> Change
      </button>
      <button
        onClick={onScan}
        disabled={isScanning}
        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-gray-900 disabled:opacity-40"
      >
        {isScanning ? (
          <>
            <Loader size={16} className="animate-spin" /> Scanning...
          </>
        ) : (
          <>
            <ScanLine size={16} /> Scan Receipt
          </>
        )}
      </button>
    </div>
  </div>
);

const ScanningOverlay: React.FC<{ progress: number; status: string }> = ({ progress, status }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    <p className="text-sm font-semibold text-white">{status}</p>
    <progress className="h-2 w-48 overflow-hidden rounded-full" max={100} value={progress} />
    <p className="text-xs text-white/70">{progress}%</p>
  </div>
);

export const ResultsView: React.FC<{
  scanResult: ReceiptScanResult;
  accounts: Account[];
  selectedAccountId: number | null;
  currency: string;
  expenseCategoryOptions: string[];
  isFormPrefillMode: boolean;
  expenseMode: 'individual' | 'group';
  onAccountChange: (id: number | null) => void;
  onFieldChange: ScanFieldUpdater;
  onSubcategoryChange: (value: string) => void;
  onRescan: () => void;
  onSubmit: () => void;
}> = ({
  scanResult,
  accounts,
  selectedAccountId,
  currency,
  expenseCategoryOptions,
  isFormPrefillMode,
  expenseMode,
  onAccountChange,
  onFieldChange,
  onSubcategoryChange,
  onRescan,
  onSubmit,
}) => (
  <div className="space-y-4">
    <ConfidenceBadge confidence={scanResult.confidence ?? 0} />

    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
      <AmountField
        amount={scanResult.amount}
        currency={currency}
        onChange={(value) => onFieldChange('amount', value)}
      />

      <TextField
        label="Merchant"
        value={scanResult.merchantName || ''}
        onChange={(value) => onFieldChange('merchantName', value)}
        placeholder="Merchant name"
      />

      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <TextField
          label="Currency"
          value={scanResult.currency || currency}
          onChange={(value) => onFieldChange('currency', value.toUpperCase())}
        />
        <TextField
          label="Payment"
          value={scanResult.paymentMethod || ''}
          onChange={(value) => onFieldChange('paymentMethod', value)}
          placeholder="Card, UPI, Cash..."
        />
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100">
        <DateField
          label="Date"
          value={scanResult.date}
          onChange={(date) => onFieldChange('date', date)}
        />
        <SelectField
          label="Category"
          value={scanResult.category || ''}
          options={expenseCategoryOptions}
          onChange={(value) => onFieldChange('category', value)}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <TextField
          label="Time"
          value={scanResult.time || ''}
          onChange={(value) => onFieldChange('time', value)}
          placeholder="18:45"
        />
        <NumberField
          label="Subtotal"
          value={scanResult.subtotal}
          onChange={(value) => onFieldChange('subtotal', value)}
        />
        <NumberField
          label="Tax"
          value={scanResult.taxAmount}
          onChange={(value) => onFieldChange('taxAmount', value)}
        />
      </div>

      <TextField
        label="Invoice Number"
        value={scanResult.invoiceNumber || ''}
        onChange={(value) => onFieldChange('invoiceNumber', value)}
        placeholder="Invoice or receipt reference"
      />

      <div className="p-4">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Subcategory
        </label>
        <input
          type="text"
          value={scanResult.subcategory || ''}
          onChange={(event) => onSubcategoryChange(event.target.value)}
          className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
          placeholder="Groceries, Fuel / Petrol, Netflix, Uber Ride..."
        />
        <p className="mt-1 text-xs text-gray-400">
          Edit this if the scan found the wrong expense type. The main category updates automatically.
        </p>
      </div>

      <TextField
        label="Notes"
        value={scanResult.notes || ''}
        onChange={(value) => onFieldChange('notes', value)}
        placeholder="Fuel receipt, hotel bill, office expense..."
      />

      {scanResult.items && scanResult.items.length > 0 && (
        <ItemsList items={scanResult.items} currency={currency} />
      )}
    </div>

    <AccountSelector
      accounts={accounts}
      selectedId={selectedAccountId}
      currency={currency}
      onChange={onAccountChange}
    />

    <ActionButtons
      onRescan={onRescan}
      onSubmit={onSubmit}
      isFormPrefillMode={isFormPrefillMode}
      expenseMode={expenseMode}
      isDisabled={!selectedAccountId || !scanResult.amount}
    />
  </div>
);

const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const isHighConfidence = confidence >= 0.8;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl p-3.5',
        isHighConfidence ? 'border border-emerald-100 bg-emerald-50' : 'border border-amber-100 bg-amber-50',
      )}
    >
      {isHighConfidence ? (
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle size={18} className="shrink-0 text-amber-600" />
      )}
      <div>
        <p className={cn('text-sm font-bold', isHighConfidence ? 'text-emerald-800' : 'text-amber-800')}>
          {isHighConfidence ? 'High confidence scan' : 'Please review the extracted data'}
        </p>
        <p className={cn('text-xs', isHighConfidence ? 'text-emerald-600' : 'text-amber-600')}>
          Confidence: {(confidence * 100).toFixed(0)}% - edit any field if needed
        </p>
      </div>
    </div>
  );
};

const AmountField: React.FC<{
  amount?: number;
  currency: string;
  onChange: (value: number) => void;
}> = ({ amount, currency, onChange }) => (
  <div className="p-4">
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      Total Amount *
    </label>
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-gray-500">{currency}</span>
      <input
        type="number"
        step="0.01"
        value={amount || ''}
        onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
        className="font-display flex-1 bg-transparent text-2xl font-bold text-gray-900 focus:outline-none"
        placeholder="0.00"
      />
    </div>
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div className="p-4">
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
      placeholder={placeholder}
    />
  </div>
);

const NumberField: React.FC<{
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="p-4">
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      {label}
    </label>
    <input
      type="number"
      step="0.01"
      value={value || ''}
      onChange={(event) => onChange(parseFloat(event.target.value) || undefined)}
      className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
      aria-label={label}
      title={label}
    />
  </div>
);

const DateField: React.FC<{
  label: string;
  value?: Date;
  onChange: (date?: Date) => void;
}> = ({ label, value, onChange }) => (
  <div className="p-4">
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      {label}
    </label>
    <input
      type="date"
      value={value ? toLocalDateKey(value) ?? '' : ''}
      onChange={(event) => {
        const parsed = parseDateInputValue(event.target.value);
        onChange(parsed ?? value);
      }}
      className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
      aria-label={label}
      title={label}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="p-4">
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      {label}
    </label>
    <select
      value={value}
      onChange={(event) => onChange(normalizeCategorySelection(event.target.value, 'expense'))}
      className="w-full appearance-none bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
      aria-label={label}
      title={label}
    >
      {options.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  </div>
);

const ItemsList: React.FC<{
  items: Array<{ name: string; amount: number }>;
  currency: string;
}> = ({ items, currency }) => (
  <div className="p-4">
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
      Detected Items ({items.length})
    </p>
    <div className="max-h-32 space-y-1 overflow-y-auto">
      {items.map((item, index) => (
        <div key={index} className="flex justify-between border-b border-gray-100 py-1 text-xs last:border-0">
          <span className="mr-4 truncate text-gray-600">{item.name}</span>
          <span className="shrink-0 font-semibold text-gray-900">
            {currency} {item.amount.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const AccountSelector: React.FC<{
  accounts: Account[];
  selectedId: number | null;
  currency: string;
  onChange: (id: number | null) => void;
}> = ({ accounts, selectedId, currency, onChange }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
      Charge to Account *
    </label>
    <select
      value={selectedId || ''}
      onChange={(event) => {
        const parsed = parseInt(event.target.value, 10);
        onChange(Number.isNaN(parsed) ? null : parsed);
      }}
      className="w-full appearance-none bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
      aria-label="Charge to account"
      title="Charge to account"
    >
      <option value="">Select an account</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name} ({currency} {account.balance.toFixed(2)})
        </option>
      ))}
    </select>
  </div>
);

const ActionButtons: React.FC<{
  onRescan: () => void;
  onSubmit: () => void;
  isFormPrefillMode: boolean;
  expenseMode: 'individual' | 'group';
  isDisabled: boolean;
}> = ({ onRescan, onSubmit, isFormPrefillMode, expenseMode, isDisabled }) => (
  <div className="flex gap-3">
    <button
      onClick={onRescan}
      className="flex-[0.4] flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
    >
      <RefreshCw size={13} /> Rescan
    </button>
    <button
      onClick={onSubmit}
      disabled={isDisabled}
      className="flex-1 rounded-xl bg-black py-3 text-sm font-bold text-white shadow-lg transition-colors hover:bg-gray-900 disabled:opacity-40"
    >
      {isFormPrefillMode
        ? `Use in ${expenseMode === 'group' ? 'Group' : 'Individual'} Expense`
        : 'Add Transaction'}
    </button>
  </div>
);
