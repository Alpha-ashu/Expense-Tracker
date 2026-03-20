// -----------------------------------------------------------------------
// Tax component — one row from the bill's tax section
// (e.g. CGST 2.5% ₹12.50, VAT 5% ₹25.00)
// -----------------------------------------------------------------------
export interface TaxComponent {
  name: string;      // "CGST" | "SGST" | "VAT" | "Sales Tax" | …
  rate?: number;     // percentage (optional)
  amount: number;    // currency amount
}

// -----------------------------------------------------------------------
// Individual line item with optional qty + rate
// -----------------------------------------------------------------------
export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

// -----------------------------------------------------------------------
// Validation result — did items + taxes ≈ total?
// -----------------------------------------------------------------------
export interface TotalValidationResult {
  isValid: boolean;
  calculated: number;   // what we computed from items + taxes
  detected: number;     // what was printed on the bill
}

// -----------------------------------------------------------------------
// Core scan result — all fields are optional (partial scans are normal)
// -----------------------------------------------------------------------
export interface ReceiptScanResult {
  // Core fields
  merchantName?: string;
  amount?: number;
  date?: Date;
  time?: string;
  currency?: string;
  subtotal?: number;
  taxAmount?: number;

  // Global intelligence
  location?: string;          // "INDIA" | "USA" | "EU" | "UAE" | "UK" | "UNKNOWN"
  taxBreakdown?: TaxComponent[];   // CGST/SGST/VAT/Sales Tax breakdown

  // Validation
  validationResult?: TotalValidationResult;

  // Meta
  paymentMethod?: string;
  invoiceNumber?: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  description?: string;        // AI-generated: "Mutton Curry ₹350, Rice ₹50"

  // Items — enriched with qty + rate
  items?: ReceiptLineItem[];

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
