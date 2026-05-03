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
    /(?:opening|opening\s*balance|ob)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i,
    /(?:closing|closing\s*balance|cb)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i,
    /balance\s*(?:brought\s*forward|brought\s*forward)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i,
    /balance\s*(?:carried\s*forward|carried\s*forward)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i,
  ],
  transaction: [
    // Date, Description, Amount patterns
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+INR?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
    /(\d{1,2}-\d{1,2}-\d{2,4})\s+(.+?)\s+INR?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
    /(\d{2,4}\/\d{1,2}\/\d{1,2})\s+(.+?)\s+INR?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)?/i,
  ],
};

const BANK_KEYWORDS = [
  'bank', 'statement', 'account', 'balance', 'debit', 'credit', 'withdrawal', 'deposit',
  'transfer', 'neft', 'rtgs', 'imps', 'upi', 'transaction', 'passbook'
];

const HEADER_LINE_PATTERN = /^(period|statement|account|a\/c|customer\s*id|opening\s*balance|closing\s*balance|balance\s*(?:brought|carried)\s*forward)\b/i;
const TRANSACTION_TABLE_HEADER_PATTERN = /\b(date|value\s*date)\b.*\b(description|particulars|narration|remarks)\b.*\b(debit|credit|withdrawal|deposit|amount|balance)\b/i;
const DATE_PREFIX_PATTERN = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2,4}[/-]\d{1,2}[/-]\d{1,2})\s+(.+)$/i;
const AMOUNT_TOKEN_PATTERN = /INR?\s*[\d,]+(?:\.\d{2})?/gi;

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
  return parseFloat(amount.replace(/[,\sINR]/g, ''));
}

function normalizeStatementLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function isStatementHeaderLine(line: string): boolean {
  return HEADER_LINE_PATTERN.test(line) || TRANSACTION_TABLE_HEADER_PATTERN.test(line);
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
    const openingMatch = line.match(/(?:opening|opening\s*balance|ob|balance\s*brought\s*forward)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i);
    if (openingMatch) {
      balances.opening = normalizeAmount(openingMatch[1]);
      continue;
    }
    
    const closingMatch = line.match(/(?:closing|closing\s*balance|cb|balance\s*carried\s*forward)\s*:?\s*INR?\s*([\d,]+(?:\.\d{2})?)/i);
    if (closingMatch) {
      balances.closing = normalizeAmount(closingMatch[1]);
    }
  }
  
  return balances;
}

function extractTrailingAmountBlock(text: string) {
  return text.match(/((?:INR?\s*[\d,]+(?:\.\d{2})?\s*){1,3})$/i);
}

function parseTrailingAmountColumns(
  values: number[],
  description: string,
): { amount: number; type: 'credit' | 'debit'; balance?: number } | null {
  if (values.length === 0) return null;

  if (values.length >= 3) {
    const [debit, credit, balance] = values.slice(-3);
    if (debit > 0 && credit === 0) {
      return { amount: debit, type: 'debit', balance };
    }
    if (credit > 0 && debit === 0) {
      return { amount: credit, type: 'credit', balance };
    }

    const inferredType = detectTransactionType(description, Math.max(debit, credit));
    return {
      amount: inferredType === 'credit' ? Math.max(credit, debit) : Math.max(debit, credit),
      type: inferredType,
      balance,
    };
  }

  if (values.length === 2) {
    const [amount, balance] = values;
    return {
      amount,
      type: detectTransactionType(description, amount),
      balance,
    };
  }

  const [amount] = values;
  return {
    amount,
    type: detectTransactionType(description, amount),
  };
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

  for (const rawLine of lines) {
    const line = normalizeStatementLine(rawLine);
    if (!line || isStatementHeaderLine(line)) continue;

    let match = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{2,4}[/-]\d{1,2}[/-]\d{1,2})\s+(.+?)\s+INR?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)\s*(?:INR?\s*([\d,]+(?:\.\d{2})?))?$/i);
    let date = '';
    let description = '';
    let amount = '';
    let creditDebit = '';
    let balance = '';

    if (match) {
      [, date, description, amount, creditDebit, balance = ''] = match;
    } else {
      const datedLineMatch = line.match(DATE_PREFIX_PATTERN);
      if (datedLineMatch) {
        const [, parsedDate, remainder] = datedLineMatch;
        const amountBlock = extractTrailingAmountBlock(remainder);

        if (amountBlock && typeof amountBlock.index === 'number') {
          const trailingValues = (amountBlock[1].match(AMOUNT_TOKEN_PATTERN) || [])
            .map((token) => normalizeAmount(token))
            .filter((value) => Number.isFinite(value));
          const parsedDescription = remainder
            .slice(0, amountBlock.index)
            .replace(/\b(?:cr|dr)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const parsedColumns = parseTrailingAmountColumns(trailingValues, parsedDescription);

          if (parsedDescription && parsedColumns) {
            transactions.push({
              date: parsedDate.trim(),
              description: parsedDescription,
              amount: parsedColumns.amount,
              type: parsedColumns.type,
              balance: parsedColumns.balance,
              category: categorizeTransaction(parsedDescription),
            });
            continue;
          }
        }
      }

      match = line.match(/^(.+?)\s+INR?\s*([\d,]+(?:\.\d{2})?)\s*(CR|DR)\s*(?:INR?\s*([\d,]+(?:\.\d{2})?))?$/i);
      if (!match) continue;

      [, description, amount, creditDebit, balance = ''] = match;
      if (!/[a-z]/i.test(description)) continue;
      if (isStatementHeaderLine(description)) continue;
    }

    const normalizedAmount = normalizeAmount(amount);
    const cleanedDescription = description.trim();
    const type = detectTransactionType(cleanedDescription, normalizedAmount, creditDebit);
    const category = categorizeTransaction(cleanedDescription);
    const normalizedBalance = balance ? normalizeAmount(balance) : undefined;

    transactions.push({
      date: date.trim(),
      description: cleanedDescription,
      amount: normalizedAmount,
      type,
      balance: normalizedBalance,
      category,
    });
  }

  return transactions;
}

function isBankStatement(text: string): boolean {
  const normalizedText = text.toLowerCase();
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const keywordHits = BANK_KEYWORDS.filter(keyword =>
    normalizedText.includes(keyword.toLowerCase())
  ).length;
  const transactionLineCount = extractTransactions(lines).length;
  const balances = extractBalances(lines);
  const metadataSignals = Number(Boolean(extractAccountNumber(lines)))
    + Number(Boolean(extractStatementPeriod(lines)))
    + Number(balances.opening !== undefined)
    + Number(balances.closing !== undefined);

  return keywordHits >= 3 || transactionLineCount >= 2 || (transactionLineCount >= 1 && metadataSignals >= 1);
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
