import { ReceiptScannerResult } from './receiptScannerService';

export interface BankStatementResult {
  accountNumber?: string;
  statementPeriod?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    balance?: number;
    category?: string;
  }>;
  confidence?: number;
  rawText?: string;
}

const BANK_STATEMENT_PATTERNS = {
  accountNumber: [
    /account\s*(?:no|number|#)\s*:?\s*([A-Z0-9]{6,})/i,
    /a\/c\s*(?:no|number|#)\s*:?\s*([A-Z0-9]{6,})/i,
    /customer\s*id\s*:?\s*([A-Z0-9]{6,})/i,
  ],
  statementPeriod: [
    /period\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|till|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /statement\s*(?:date|period)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|till|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /from\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|till|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ],
  balance: [
    /(?:opening|opening\s*balance|ob)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:closing|closing\s*balance|cb)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i,
    /balance\s*(?:brought\s*forward|brought\s*forward)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i,
    /balance\s*(?:carried\s*forward|carried\s*forward)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i,
  ],
  transaction: [
    // Date, Description, Amount patterns
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+₹?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
    /(\d{1,2}-\d{1,2}-\d{2,4})\s+(.+?)\s+₹?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
    /(\d{2,4}\/\d{1,2}\/\d{1,2})\s+(.+?)\s+₹?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
  ],
};

const BANK_KEYWORDS = [
  'bank', 'statement', 'account', 'balance', 'debit', 'credit', 'withdrawal', 'deposit',
  'transfer', 'neft', 'rtgs', 'imps', 'upi', 'transaction', 'passbook'
];

const TRANSACTION_DESCRIPTION_PATTERNS = {
  atm: /atm|cash\s*withdrawal/i,
  transfer: /transfer|neft|rtgs|imps|upi/i,
  pos: /pos|point\s*of\s*sale|card\s*payment/i,
  cheque: /cheque|check/i,
  deposit: /deposit|cash\s*deposit/i,
  charges: /charges|fees|penalty|fine/i,
  interest: /interest/i,
  salary: /salary|payroll|pay/i,
  refund: /refund|reversal/i,
};

function normalizeAmount(amount: string): number {
  return parseFloat(amount.replace(/[,\s₹]/g, ''));
}

function detectTransactionType(description: string, amount: number, creditDebit?: string): 'credit' | 'debit' {
  const desc = description.toLowerCase();
  
  if (creditDebit) {
    return creditDebit.toLowerCase() === 'cr' ? 'credit' : 'debit';
  }
  
  if (TRANSACTION_DESCRIPTION_PATTERNS.salary.test(desc) || 
      TRANSACTION_DESCRIPTION_PATTERNS.deposit.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.refund.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.interest.test(desc)) {
    return 'credit';
  }
  
  if (TRANSACTION_DESCRIPTION_PATTERNS.atm.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.transfer.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.pos.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.cheque.test(desc) ||
      TRANSACTION_DESCRIPTION_PATTERNS.charges.test(desc)) {
    return 'debit';
  }
  
  return amount > 0 ? 'debit' : 'credit';
}

function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  
  for (const [category, pattern] of Object.entries(TRANSACTION_DESCRIPTION_PATTERNS)) {
    if (pattern.test(desc)) {
      switch (category) {
        case 'atm': return 'ATM Withdrawal';
        case 'transfer': return 'Bank Transfer';
        case 'pos': return 'Card Payment';
        case 'cheque': return 'Cheque Transaction';
        case 'deposit': return 'Cash Deposit';
        case 'charges': return 'Bank Charges';
        case 'interest': return 'Interest';
        case 'salary': return 'Salary';
        case 'refund': return 'Refund';
        default: return 'Other';
      }
    }
  }
  
  return 'Other';
}

function extractAccountNumber(lines: string[]): string | undefined {
  for (const line of lines) {
    for (const pattern of BANK_STATEMENT_PATTERNS.accountNumber) {
      const match = line.match(pattern);
      if (match) return match[1];
    }
  }
  return undefined;
}

function extractStatementPeriod(lines: string[]): string | undefined {
  for (const line of lines) {
    for (const pattern of BANK_STATEMENT_PATTERNS.statementPeriod) {
      const match = line.match(pattern);
      if (match) return `${match[1]} to ${match[2]}`;
    }
  }
  return undefined;
}

function extractBalances(lines: string[]): { opening?: number; closing?: number } {
  const balances: { opening?: number; closing?: number } = {};
  
  for (const line of lines) {
    const openingMatch = line.match(/(?:opening|opening\s*balance|ob)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);
    if (openingMatch) {
      balances.opening = normalizeAmount(openingMatch[1]);
      continue;
    }
    
    const closingMatch = line.match(/(?:closing|closing\s*balance|cb)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);
    if (closingMatch) {
      balances.closing = normalizeAmount(closingMatch[1]);
    }
  }
  
  return balances;
}

function extractTransactions(lines: string[]): Array<{
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  balance?: number;
  category?: string;
}> {
  const transactions: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    balance?: number;
    category?: string;
  }> = [];
  
  for (const line of lines) {
    for (const pattern of BANK_STATEMENT_PATTERNS.transaction) {
      const match = line.match(pattern);
      if (match) {
        const [, date, description, amount, creditDebit] = match;
        const normalizedAmount = normalizeAmount(amount);
        const type = detectTransactionType(description.trim(), normalizedAmount, creditDebit);
        const category = categorizeTransaction(description.trim());
        
        transactions.push({
          date: date.trim(),
          description: description.trim(),
          amount: normalizedAmount,
          type,
          category,
        });
        break;
      }
    }
  }
  
  return transactions;
}

function isBankStatement(text: string): boolean {
  const keywords = BANK_KEYWORDS.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  return keywords.length >= 3;
}

export async function parseBankStatement(rawText: string): Promise<BankStatementResult> {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  if (!isBankStatement(rawText)) {
    return {
      transactions: [],
      confidence: 0.1,
      rawText,
    };
  }
  
  const accountNumber = extractAccountNumber(lines);
  const statementPeriod = extractStatementPeriod(lines);
  const balances = extractBalances(lines);
  const transactions = extractTransactions(lines);
  
  // Calculate confidence based on extracted data
  let confidence = 0.3;
  if (accountNumber) confidence += 0.2;
  if (statementPeriod) confidence += 0.2;
  if (balances.opening !== undefined) confidence += 0.1;
  if (balances.closing !== undefined) confidence += 0.1;
  if (transactions.length > 0) confidence += Math.min(0.3, transactions.length * 0.05);
  
  return {
    accountNumber,
    statementPeriod,
    openingBalance: balances.opening,
    closingBalance: balances.closing,
    transactions,
    confidence: Math.min(confidence, 1.0),
    rawText,
  };
}

export async function preprocessBankStatementImage(file: File): Promise<Blob> {
  // Optimized preprocessing for bank statements
  const canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        
        // Scale down for faster processing but maintain readability
        const maxWidth = 2000;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
  
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/jpeg', 0.8);
  });
}
