export interface ReceiptScanResult {
  merchantName?: string;
  amount?: number;
  date?: Date;
  time?: string;
  currency?: string;
  taxAmount?: number;
  subtotal?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  items?: Array<{ name: string; amount: number }>;
  confidence?: number;
  rawText?: string;
}

export interface ReceiptScanPayload extends ReceiptScanResult {
  accountId: number;
}

export interface ReceiptScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated?: (transactionId: number) => void;
  onApplyScan?: (scan: ReceiptScanPayload) => void;
  expenseMode?: 'individual' | 'group';
  initialAccountId?: number | null;
}

export interface OCRProgress {
  status: string;
  progress: number;
}
