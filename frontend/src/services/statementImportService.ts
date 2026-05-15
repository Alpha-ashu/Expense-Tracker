/**
 * Statement import service
 * Parses PDF, CSV, and text-based spreadsheet exports into previewable transactions.
 */

import { db, type Transaction } from '@/lib/database';
import { documentIntelligenceService } from './documentIntelligenceService';
import { createWorker } from 'tesseract.js';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export interface ParsedTransaction {
  transaction_date: Date;
  raw_description: string;
  cleaned_description: string;
  amount: number;
  transaction_type: 'expense' | 'income' | 'transfer';
  balance_after_transaction?: number;
  payment_channel: string;
  merchant_name?: string;
  category?: string;
  currency?: string;
  duplicateKey?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  sourceAccountName?: string;
  confidenceScore?: number;
}

export interface ImportResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: string[];
  summary: {
    total: number;
    credits: number;
    debits: number;
    count: number;
    duplicates: number;
  };
  statementAccountName?: string;
  suggestedAccountId?: number;
  suggestedAccountName?: string;
  documentId?: number;
}

export interface StatementImportOptions {
  accountId: number;
  userId: string;
  accountType: string;
  documentId?: number;
}

export interface ImportApplyResult {
  importedCount: number;
  insertedTransactionIds: number[];
  importedTransactions: ParsedTransaction[];
}

type TransactionColumns = {
  date?: number;
  description?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  balance?: number;
  currency?: number;
};

const PAYMENT_CHANNELS: Record<string, string> = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  cred: 'CRED',
  upi: 'UPI',
  imps: 'Bank Transfer',
  neft: 'Bank Transfer',
  rtgs: 'Bank Transfer',
  card: 'Card',
  visa: 'Card',
  mastercard: 'Card',
  atm: 'ATM',
  netbanking: 'Net Banking',
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeHeader = (value: string) => normalizeText(value).replace(/\s+/g, '');

const parseAmount = (value: string | number | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const cleaned = trimmed
    .replace(/[()]/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,(?=\d{3}\b)/g, '');

  if (!cleaned) return null;
  const normalized = cleaned.includes('.') ? cleaned : cleaned.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
};

const parseDate = (value: string | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const exactPatterns: Array<RegExp> = [
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/,
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
    /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})$/i,
  ];

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  for (const pattern of exactPatterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    if (pattern.source.startsWith('^(\\d{4})')) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    if (/jan|feb|mar/i.test(pattern.source)) {
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
      return new Date(year, monthMap[match[2].slice(0, 3).toLowerCase()], Number(match[1]));
    }

    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1]));
  }

  const relaxed = new Date(trimmed);
  return Number.isNaN(relaxed.getTime()) ? null : relaxed;
};

const createDelimitedRows = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if (!insideQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
};

const guessDelimiter = (text: string) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const candidates = [',', ';', '\t', '|'];
  return candidates.sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0] ?? ',';
};

function detectColumns(headerRow: string[]): TransactionColumns {
  const columns: TransactionColumns = {};

  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    if (!columns.date && ['date', 'transactiondate', 'valuedate', 'posteddate'].includes(normalized)) columns.date = index;
    if (!columns.description && ['description', 'narration', 'details', 'particulars', 'merchant', 'remarks'].includes(normalized)) columns.description = index;
    if (!columns.debit && ['debit', 'withdrawal', 'withdrawals', 'spent'].includes(normalized)) columns.debit = index;
    if (!columns.credit && ['credit', 'deposit', 'received', 'income'].includes(normalized)) columns.credit = index;
    if (!columns.amount && ['amount', 'transactionamount', 'value', 'total'].includes(normalized)) columns.amount = index;
    if (!columns.balance && ['balance', 'closingbalance', 'runningbalance'].includes(normalized)) columns.balance = index;
    if (!columns.currency && ['currency', 'currencycode'].includes(normalized)) columns.currency = index;
  });

  return columns;
}

function looksLikeTableRows(rows: string[][]) {
  return rows.length > 1 && rows[0].length >= 3;
}

function cleanDescription(value: string) {
  return value
    .replace(/\b(?:ref|txn|trn|utr|chq|cheque|no)\b[:\s-]*[a-z0-9/-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPaymentChannel(description: string) {
  const normalized = normalizeText(description);
  return Object.entries(PAYMENT_CHANNELS).find(([keyword]) => normalized.includes(keyword))?.[1] ?? 'Bank';
}

function pickMerchantName(description: string) {
  const normalizedMerchant = documentIntelligenceService.normalizeMerchantName(description);
  if (!normalizedMerchant) return undefined;
  return documentIntelligenceService.toTitleCase(normalizedMerchant);
}

function generateDuplicateKey(accountId: number, transaction: ParsedTransaction) {
  const dateKey = transaction.transaction_date.toISOString().split('T')[0];
  const descriptionKey = normalizeText(transaction.merchant_name || transaction.cleaned_description).replace(/\s+/g, '');
  return `${accountId}|${dateKey}|${Math.abs(transaction.amount).toFixed(2)}|${descriptionKey.slice(0, 60)}`;
}

class StatementImportService {
  async parseStatement(file: File, options: StatementImportOptions): Promise<ImportResult> {
    const errors: string[] = [];
    const documentId = options.documentId ?? await documentIntelligenceService.createDocumentRecord({
      documentType: 'statement',
      file,
      processingStatus: 'processing',
      accountId: options.accountId,
    });

    try {
      let rawText = '';
      let transactions: ParsedTransaction[] = [];

      if (file.type === 'application/pdf') {
        rawText = await this.extractPdfText(file);
        const compactTextLength = rawText.replace(/\s+/g, '').length;

        if (compactTextLength < 120) {
          const ocrText = await this.extractPdfTextWithOcr(file);
          if (ocrText.replace(/\s+/g, '').length > compactTextLength) {
            rawText = ocrText;
          }
        }

        transactions = await this.extractTransactionsFromText(rawText, options.userId);
      } else if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        rawText = await file.text();
        transactions = await this.extractTransactionsFromDelimitedText(rawText, options.userId);
      } else {
        const spreadsheet = await this.extractTransactionsFromSpreadsheet(file, options.userId, errors);
        rawText = spreadsheet.rawText;
        transactions = spreadsheet.transactions;
      }

      const statementAccountName = documentIntelligenceService.detectBankName(rawText);
      const suggestedAccount = await this.findSuggestedAccount(statementAccountName);
      const annotatedTransactions = await this.annotateTransactions(transactions, options);
      const summary = this.generateSummary(annotatedTransactions);

      await documentIntelligenceService.updateDocumentRecord(documentId, {
        processingStatus: 'preview',
        sourceAccountName: statementAccountName,
        metadata: {
          detectedBank: statementAccountName || '',
          transactionCount: String(annotatedTransactions.length),
        },
      });

      return {
        success: annotatedTransactions.length > 0,
        transactions: annotatedTransactions,
        errors,
        summary,
        statementAccountName,
        suggestedAccountId: suggestedAccount?.id,
        suggestedAccountName: suggestedAccount?.name,
        documentId,
      };
    } catch (error) {
      await documentIntelligenceService.updateDocumentRecord(documentId, {
        processingStatus: 'failed',
      });

      return {
        success: false,
        transactions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        summary: { total: 0, credits: 0, debits: 0, count: 0, duplicates: 0 },
        documentId,
      };
    }
  }

  async importTransactions(transactions: ParsedTransaction[], options: StatementImportOptions): Promise<ImportApplyResult> {
    const validTransactions = transactions.filter((transaction) =>
      transaction.transaction_date && !Number.isNaN(transaction.transaction_date.getTime()),
    );

    if (validTransactions.length === 0) {
      throw new Error('No valid transactions selected for import');
    }

    let insertedTransactionIds: number[] = [];

    await db.transaction('rw', [db.transactions, db.accounts, db.documents, db.merchantProfiles, db.userCategoryPreferences], async () => {
      const newTransactions: Transaction[] = validTransactions.map((transaction) => ({
        accountId: options.accountId,
        userId: options.userId,
        date: transaction.transaction_date,
        description: transaction.cleaned_description,
        amount: Math.abs(transaction.amount),
        type: transaction.transaction_type,
        category: transaction.category || 'Others',
        merchant: transaction.merchant_name,
        createdAt: new Date(),
        paymentChannel: transaction.payment_channel,
        balanceAfter: transaction.balance_after_transaction,
        rawDescription: transaction.raw_description,
      } as unknown as Transaction));

      const insertedKeys = await db.transactions.bulkAdd(newTransactions, { allKeys: true });
      insertedTransactionIds = insertedKeys
        .map((key) => Number(key))
        .filter((key) => Number.isFinite(key));

      const account = await db.accounts.get(options.accountId);
      if (account) {
        const netChange = validTransactions.reduce((sum, transaction) => (
          sum + (transaction.transaction_type === 'income' ? transaction.amount : -Math.abs(transaction.amount))
        ), 0);

        await db.accounts.update(options.accountId, {
          balance: account.balance + netChange,
          updatedAt: new Date(),
        });
      }

      for (const transaction of validTransactions) {
        if (transaction.merchant_name) {
          await documentIntelligenceService.upsertMerchantProfile({
            merchantName: transaction.merchant_name,
            normalizedName: documentIntelligenceService.normalizeMerchantName(transaction.merchant_name),
            suggestedCategory: transaction.category || 'Others',
            confidenceScore: transaction.confidenceScore ?? 0.82,
            userId: options.userId,
          });
        }

        await documentIntelligenceService.upsertCategoryPreference({
          userId: options.userId,
          merchantKey: transaction.merchant_name,
          keywordKey: `${transaction.cleaned_description} ${transaction.raw_description}`,
          category: transaction.category || 'Others',
          confidenceScore: transaction.confidenceScore ?? 0.82,
        });
      }

      if (options.documentId) {
        await documentIntelligenceService.updateDocumentRecord(options.documentId, {
          processingStatus: 'completed',
          notes: `Imported ${validTransactions.length} transactions`,
        });
      }
    });

    return {
      importedCount: validTransactions.length,
      insertedTransactionIds,
      importedTransactions: validTransactions,
    };
  }

  private async extractPdfText(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableFontFace: true }).promise;
    let fullText = '';

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent({
        disableCombineTextItems: false,
        includeMarkedContent: false,
      });

      const rows = new Map<number, Array<{ x: number; text: string }>>();

      for (const item of textContent.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        const current = rows.get(y) ?? [];
        current.push({ x, text: item.str });
        rows.set(y, current);
      }

      const pageLines = Array.from(rows.entries())
        .sort((left, right) => right[0] - left[0])
        .map(([, entries]) => entries.sort((left, right) => left.x - right.x).map((entry) => entry.text).join(' '))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      fullText += `${pageLines.join('\n')}\n`;
    }

    return fullText;
  }

  private async extractPdfTextWithOcr(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableFontFace: true }).promise;
    const maxPages = Math.min(pdf.numPages, 4);
    const pageTexts: string[] = [];

    const worker = await createWorker('eng', 1);

    try {
      for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
        const page = await pdf.getPage(pageIndex);
        const viewport = page.getViewport({ scale: 2.25 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        const context = canvas.getContext('2d');
        if (!context) continue;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        for (let i = 0; i < data.length; i += 4) {
          const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const bw = lum > 170 ? 255 : 0;
          data[i] = bw;
          data[i + 1] = bw;
          data[i + 2] = bw;
          data[i + 3] = 255;
        }
        context.putImageData(imageData, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((value) => resolve(value), 'image/png', 0.95);
        });
        if (!blob) continue;

        const result = await worker.recognize(blob);
        const pageText = result.data.text?.trim();
        if (pageText) {
          pageTexts.push(pageText);
        }
      }
    } finally {
      await worker.terminate();
    }

    return pageTexts.join('\n');
  }

  private async extractTransactionsFromSpreadsheet(file: File, userId: string, errors: string[]) {
    const text = await file.text();
    const rawText = text.replace(/\u0000/g, ' ');

    if (/^\s*PK/.test(rawText)) {
      errors.push('Binary Excel files cannot be parsed safely in the current browser build. Export the statement as CSV and upload that file.');
      return { rawText: '', transactions: [] };
    }

    if (/<(?:table|worksheet|Workbook|Row|Cell)/i.test(rawText)) {
      const parser = new DOMParser();
      const xml = parser.parseFromString(rawText, 'text/xml');
      const rows = Array.from(xml.querySelectorAll('Row, tr')).map((row) =>
        Array.from(row.querySelectorAll('Cell, Data, td, th')).map((cell) => (cell.textContent || '').trim()),
      );

      return {
        rawText,
        transactions: await this.extractTransactionsFromRows(rows, userId),
      };
    }

    if (looksLikeTableRows(createDelimitedRows(rawText, guessDelimiter(rawText)))) {
      return {
        rawText,
        transactions: await this.extractTransactionsFromDelimitedText(rawText, userId),
      };
    }

    errors.push('Spreadsheet format was detected but no transaction rows could be extracted.');
    return { rawText: '', transactions: [] };
  }

  private async extractTransactionsFromDelimitedText(text: string, userId: string) {
    const rows = createDelimitedRows(text, guessDelimiter(text));
    return this.extractTransactionsFromRows(rows, userId);
  }

  private async extractTransactionsFromRows(rows: string[][], userId: string) {
    if (!looksLikeTableRows(rows)) return [];

    const headerRow = rows[0];
    const columns = detectColumns(headerRow);
    const transactions: ParsedTransaction[] = [];

    for (const row of rows.slice(1)) {
      const date = parseDate(row[columns.date ?? -1]);
      const description = (row[columns.description ?? -1] || '').trim();
      if (!date || !description) continue;

      const debit = parseAmount(row[columns.debit ?? -1]);
      const credit = parseAmount(row[columns.credit ?? -1]);
      const fallbackAmount = parseAmount(row[columns.amount ?? -1]);
      const balance = parseAmount(row[columns.balance ?? -1]) ?? undefined;
      const amount = credit ?? debit ?? fallbackAmount;
      if (amount == null || !Number.isFinite(amount)) continue;

      const transactionType = credit != null && Math.abs(credit) > 0
        ? 'income'
        : (normalizeText(description).includes('transfer') ? 'transfer' : 'expense');

      const merchantName = pickMerchantName(description);
      const categoryPrediction = await documentIntelligenceService.predictCategory({
        merchantName,
        text: description,
        amount: Math.abs(amount),
        userId,
      });

      transactions.push({
        transaction_date: date,
        raw_description: description,
        cleaned_description: cleanDescription(description),
        amount: Math.abs(amount),
        transaction_type: transactionType,
        balance_after_transaction: balance,
        payment_channel: extractPaymentChannel(description),
        merchant_name: merchantName,
        category: categoryPrediction.category,
        confidenceScore: categoryPrediction.confidence,
        currency: row[columns.currency ?? -1] || undefined,
      });
    }

    return transactions;
  }

  private async extractTransactionsFromText(text: string, userId: string) {
    const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const transactions: ParsedTransaction[] = [];

    // Skip header/footer lines
    const SKIP_RE = /^\s*(?:statement|opening\s+balance|closing\s+balance|page\s+\d+|date\s+particulars|sl\.?\s*no|transaction\s+date|value\s+date|narration|description|debit|credit|balance|dr\s*cr|type|chq|ref|sr\s*no|account|branch|ifsc|period|from\s+date|to\s+date|\*+|-{3,}|={3,})/i;

    // A line starting a block must begin with a date token
    const DATE_START_RE = /^(\d{1,2}[\/-\.](\d{1,2}|[a-zA-Z]{3,9})[\/-\.]\d{2,4})(?:\s|$)/;

    // Ending line has two trailing decimal amounts (debit/credit + balance)
    const TRAILING_PAIR_RE = /[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s*$/;

    // --- PHASE 1: group raw lines into per-transaction blocks ---
    const blocks: Array<{ dateStr: string; lines: string[] }> = [];
    let cur: { dateStr: string; lines: string[] } | null = null;

    for (const line of lines) {
      if (SKIP_RE.test(line)) continue;

      const dm = line.match(DATE_START_RE);
      if (dm) {
        if (cur) blocks.push(cur);
        cur = { dateStr: dm[1], lines: [line] };
      } else if (cur) {
        cur.lines.push(line);
        if (TRAILING_PAIR_RE.test(line)) {
          blocks.push(cur);
          cur = null;
        }
      }
    }
    if (cur) blocks.push(cur);

    // --- PHASE 2: parse each block ---
    for (const block of blocks) {
      const date = parseDate(block.dateStr);
      if (!date) continue;

      const fullText = block.lines.join(' ');

      const amtMatches = fullText.match(/[\d,]+\.\d{2}/g) || [];
      const nums = amtMatches
        .map(v => parseAmount(v))
        .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);

      if (nums.length === 0) continue;

      let txnAmt: number;
      let balance: number | undefined;
      if (nums.length >= 2) {
        balance = nums[nums.length - 1];
        txnAmt = nums[nums.length - 2];
      } else {
        txnAmt = nums[0];
      }
      if (!txnAmt || txnAmt <= 0) continue;

      // Build description: strip date + all amounts
      const rawDesc = fullText
        .replace(block.dateStr, '')
        .replace(/[\d,]+\.\d{2}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Detect CR/DR
      const isCredit = /\bUPI\/CR\b|\bCR\b|\bcredit\b|\bsalary\b|\brefund\b|\bdeposit\b|\bcredited\b/i.test(fullText);
      const isTransfer = !isCredit && /\btransfer\b|\bneft\b|\brtgs\b|\bimps\b/i.test(fullText);
      const txnType: 'income' | 'expense' | 'transfer' = isTransfer ? 'transfer' : isCredit ? 'income' : 'expense';

      // Extract UPI reference number & merchant
      const upiRef = fullText.match(/UPI\/(DR|CR)\/(\d+)\//i);
      const reference = upiRef?.[2];
      const merchantMatch = fullText.match(/UPI\/(DR|CR)\/\d+\/([^/]+)\//i);
      let merchantName: string | undefined = merchantMatch
        ? merchantMatch[2].replace(/[_-]/g, ' ').trim()
        : pickMerchantName(rawDesc);

      const cleanedDesc = reference
        ? cleanDescription(rawDesc) + ' (Ref: ' + reference + ')'
        : cleanDescription(rawDesc);

      const cat = await documentIntelligenceService.predictCategory({
        merchantName,
        text: cleanedDesc,
        amount: txnAmt,
        userId,
      });

      transactions.push({
        transaction_date: date,
        raw_description: fullText.slice(0, 300),
        cleaned_description: cleanedDesc,
        amount: txnAmt,
        transaction_type: txnType,
        balance_after_transaction: balance,
        payment_channel: extractPaymentChannel(fullText),
        merchant_name: merchantName,
        category: cat.category,
        currency: documentIntelligenceService.detectCurrency(fullText),
        confidenceScore: cat.confidence,
      });
    }

    return transactions;
  }

    private async annotateTransactions(transactions: ParsedTransaction[], options: StatementImportOptions) {
    const existingTransactions = await db.transactions.where('accountId').equals(options.accountId).toArray();
    const existingKeys = new Set(existingTransactions.map((transaction) => this.generateExistingDuplicateKey(options.accountId, transaction)));

    return transactions.map((transaction) => {
      const duplicateKey = generateDuplicateKey(options.accountId, transaction);
      const isDuplicate = existingKeys.has(duplicateKey);

      return {
        ...transaction,
        duplicateKey,
        isDuplicate,
        duplicateReason: isDuplicate ? 'Possible duplicate transaction detected' : undefined,
      };
    });
  }

  private generateExistingDuplicateKey(accountId: number, transaction: Transaction) {
    const date = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
    const existingTransaction: ParsedTransaction = {
      transaction_date: date,
      raw_description: String((transaction as unknown as Record<string, unknown>).rawDescription || transaction.description || ''),
      cleaned_description: String(transaction.description || ''),
      amount: Math.abs(transaction.amount),
      transaction_type: transaction.type,
      payment_channel: String((transaction as unknown as Record<string, unknown>).paymentChannel || 'Bank'),
      merchant_name: transaction.merchant,
    };

    return generateDuplicateKey(accountId, existingTransaction);
  }

  private async findSuggestedAccount(statementAccountName?: string) {
    if (!statementAccountName) return null;
    const accounts = await db.accounts.toArray();
    const normalizedTarget = normalizeText(statementAccountName);
    return accounts.find((account) => normalizeText(account.name).includes(normalizedTarget)) ?? null;
  }

  private generateSummary(transactions: ParsedTransaction[]) {
    return transactions.reduce(
      (summary, transaction) => {
        summary.count += 1;
        summary.total += transaction.amount;

        if (transaction.transaction_type === 'income') {
          summary.credits += transaction.amount;
        } else {
          summary.debits += Math.abs(transaction.amount);
        }

        if (transaction.isDuplicate) {
          summary.duplicates += 1;
        }

        return summary;
      },
      { total: 0, credits: 0, debits: 0, count: 0, duplicates: 0 },
    );
  }
}

export const statementImportService = new StatementImportService();
