import {
  db,
  type Account,
  type AppCategory,
  type ImportHistory,
  type Transaction,
} from '@/lib/database';
import {
  INCOME_CATEGORIES,
  detectExpenseCategoryFromText,
  getCategoryDetails,
  getCategoryForExpenseSubcategory,
  getExpenseCategoryNames,
  normalizeCategorySelection,
} from '@/lib/expenseCategories';
import { importDataFromJSON } from '@/lib/importExport';

type ImportFileType = 'csv' | 'json';
type ImportSourceKind = 'third-party' | 'backup';
type ImportTransactionType = 'expense' | 'income';
type CategoryResolution = 'exact' | 'mapped' | 'detected' | 'created' | 'fallback' | 'manual';

export interface ImportPreviewRow {
  id: string;
  rowNumber: number;
  transactionType: ImportTransactionType;
  accountId: number;
  date: Date | null;
  amount: number;
  description: string;
  merchant: string;
  rawCategory: string;
  rawSubcategory: string;
  category: string;
  subcategory: string;
  categoryResolution: CategoryResolution;
  duplicateKey: string;
  duplicate: boolean;
  errors: string[];
  metadata: Record<string, string>;
  originalData: Record<string, unknown>;
}

export interface ThirdPartyImportPreview {
  kind: 'third-party';
  fileName: string;
  fileType: ImportFileType;
  rows: ImportPreviewRow[];
  errors: string[];
  summary: {
    totalRecords: number;
    readyRecords: number;
    duplicateRecords: number;
    invalidRecords: number;
    exactMatches: number;
    mappedMatches: number;
    detectedMatches: number;
    createdCategories: string[];
  };
}

export interface BackupImportPreview {
  kind: 'backup';
  fileName: string;
  fileType: 'json';
  exportedAt?: string;
  version?: string;
  counts: Array<{ label: string; count: number }>;
}

export type SmartImportPreview = ThirdPartyImportPreview | BackupImportPreview;

interface AnalyzeOptions {
  defaultAccountId: number;
}

interface ApplyPreviewOptions {
  rows: ImportPreviewRow[];
  fileName: string;
  fileType: ImportFileType;
  userId?: string;
  skipDuplicates: boolean;
}

interface RestoreBackupOptions {
  fileName: string;
  jsonText: string;
  userId?: string;
}

interface ExistingCategoryCatalog {
  expenseNames: Set<string>;
  incomeNames: Set<string>;
  rawCategories: AppCategory[];
}

const IMPORTABLE_ARRAY_KEYS = ['transactions', 'expenses', 'entries', 'records', 'items', 'data'];
const DATE_KEYS = ['date', 'transactiondate', 'transaction_date', 'spentat', 'createdat', 'created_at', 'timestamp'];
const AMOUNT_KEYS = ['amount', 'total', 'value', 'price', 'expense', 'debit', 'debitamount', 'debit_amount'];
const CREDIT_KEYS = ['credit', 'creditamount', 'credit_amount', 'income'];
const CATEGORY_KEYS = ['category', 'categoryname', 'expensecategory', 'expense_type'];
const SUBCATEGORY_KEYS = ['subcategory', 'sub_category', 'subcategoryname'];
const DESCRIPTION_KEYS = ['description', 'details', 'note', 'notes', 'memo', 'title', 'narration'];
const MERCHANT_KEYS = ['merchant', 'merchantname', 'merchant_name', 'payee', 'vendor', 'store'];
const PAYMENT_KEYS = ['paymentmethod', 'payment_method', 'paymentmode', 'payment_mode', 'account', 'accountname', 'account_name'];
const CURRENCY_KEYS = ['currency', 'currencycode', 'currency_code'];
const TYPE_KEYS = ['type', 'transactiontype', 'transaction_type', 'entrytype', 'entry_type'];
const FX_RATE_KEYS = ['fxrate', 'fx_rate', 'exchangerate', 'exchange_rate', 'rate'];
const KNOWN_FIELD_GROUPS = [
  ...DATE_KEYS,
  ...AMOUNT_KEYS,
  ...CREDIT_KEYS,
  ...CATEGORY_KEYS,
  ...SUBCATEGORY_KEYS,
  ...DESCRIPTION_KEYS,
  ...MERCHANT_KEYS,
  ...PAYMENT_KEYS,
  ...CURRENCY_KEYS,
  ...TYPE_KEYS,
  ...FX_RATE_KEYS,
  'id',
  'tags',
  'location',
  'receipturl',
  'receipt_url',
  'device',
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeKey = (value: string) => normalizeText(value).replace(/\s+/g, '');

const slugify = (value: string) => normalizeText(value).replace(/\s+/g, '-');

const titleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');

const toDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDisplayValue = (value: unknown): string => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toDisplayValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
};

const buildDuplicateKey = (date: Date | null, amount: number, description: string) => {
  if (!date || !Number.isFinite(amount)) return '';
  const normalizedDescription = normalizeText(description).replace(/\s+/g, '').slice(0, 80);
  return `${toDateKey(date)}|${amount.toFixed(2)}|${normalizedDescription}`;
};

const createRowId = (index: number) =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `import-row-${Date.now()}-${index}`;

const getFieldValue = (lookup: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (lookup[key] != null && String(lookup[key]).trim() !== '') {
      return lookup[key];
    }
  }
  return undefined;
};

const parseAmountValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const negative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const cleaned = trimmed
    .replace(/[()]/g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,(?=\d{3}\b)/g, '');

  const normalized = cleaned.includes('.') ? cleaned : cleaned.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
};

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const candidate = new Date(value > 1e12 ? value : value * 1000);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(trimmed)) {
    const [year, month, day] = trimmed.split(/[T\s]/)[0].split(/[/-]/).map((part) => Number(part));
    const candidate = new Date(year, month - 1, day);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) {
    const [first, second, third] = trimmed.split(/[/-]/).map((part) => Number(part));
    const year = third < 100 ? 2000 + third : third;
    const dayFirst = first > 12 || second <= 12;
    const day = dayFirst ? first : second;
    const month = dayFirst ? second : first;
    const candidate = new Date(year, month - 1, day);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  const candidate = new Date(trimmed);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
};

const parseTypeValue = (value: unknown): ImportTransactionType | null => {
  const normalized = normalizeText(toDisplayValue(value));
  if (!normalized) return null;
  if (['income', 'credit', 'credit entry', 'salary', 'refund'].some((item) => normalized.includes(item))) {
    return 'income';
  }
  if (['expense', 'debit', 'purchase', 'payment', 'spend'].some((item) => normalized.includes(item))) {
    return 'expense';
  }
  return null;
};

const guessDelimiter = (text: string) => {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
  const delimiterScores = [
    { delimiter: ',', score: firstLine.split(',').length },
    { delimiter: ';', score: firstLine.split(';').length },
    { delimiter: '\t', score: firstLine.split('\t').length },
  ];

  return delimiterScores.sort((a, b) => b.score - a.score)[0]?.delimiter ?? ',';
};

const parseCsvRecords = (text: string): Array<Record<string, unknown>> => {
  const delimiter = guessDelimiter(text);
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!insideQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') index += 1;
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((cell, index) => cell.trim() || `column_${index + 1}`);

  return rows.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? '';
    });
    return record;
  });
};

const isFinoraBackupPayload = (payload: unknown): payload is Record<string, unknown> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  return Array.isArray(record.accounts) && Array.isArray(record.transactions) && typeof record.version === 'string';
};

const extractJsonRecords = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
  }

  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;

  for (const key of IMPORTABLE_ARRAY_KEYS) {
    if (Array.isArray(record[key])) {
      return record[key].filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
    }
  }

  return [];
};

const buildLookup = (record: Record<string, unknown>) => {
  const lookup: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    lookup[normalizeKey(key)] = value;
  });
  return lookup;
};

const buildDescription = (baseDescription: string, metadata: Record<string, string>, sourceName: string) => {
  const lines = Object.entries(metadata)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);

  lines.push(`Imported From: ${sourceName}`);
  return [baseDescription.trim(), ...lines].filter(Boolean).join('\n');
};

const resolveImportedAmount = (
  amount: number,
  metadata: Record<string, string>,
  targetCurrency?: string,
) => {
  const sourceCurrency = metadata.Currency?.toUpperCase();
  const normalizedTargetCurrency = targetCurrency?.toUpperCase();
  const fxRate = parseAmountValue(metadata['FX Rate']);

  if (
    sourceCurrency &&
    normalizedTargetCurrency &&
    sourceCurrency !== normalizedTargetCurrency &&
    fxRate != null &&
    Number.isFinite(fxRate) &&
    fxRate > 0
  ) {
    return Number((amount * fxRate).toFixed(2));
  }

  return amount;
};

const getIncomeCategoryNames = () => Object.values(INCOME_CATEGORIES).map((category) => category.name);

const findClosestCategory = (category: string, candidates: string[]) => {
  const normalizedTarget = normalizeText(category);
  if (!normalizedTarget) return null;

  let bestMatch: { name: string; score: number } | null = null;

  candidates.forEach((candidate) => {
    const normalizedCandidate = normalizeText(candidate);
    let score = 0;

    if (normalizedCandidate === normalizedTarget) score = 300;
    else if (normalizedCandidate.startsWith(normalizedTarget) || normalizedTarget.startsWith(normalizedCandidate)) score = 220;
    else if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) score = 180;
    else {
      const targetTokens = new Set(normalizedTarget.split(' ').filter(Boolean));
      const candidateTokens = new Set(normalizedCandidate.split(' ').filter(Boolean));
      let overlap = 0;
      targetTokens.forEach((token) => {
        if (candidateTokens.has(token)) overlap += 1;
      });
      if (overlap > 0) score = overlap * 40;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { name: candidate, score };
    }
  });

  return bestMatch && bestMatch.score >= 120 ? bestMatch.name : null;
};

const resolveExpenseCategory = (
  rawCategory: string,
  rawSubcategory: string,
  contextText: string,
  existingNames: Set<string>,
) => {
  const subcategoryCandidate = rawSubcategory || rawCategory;
  const subcategoryMatch = subcategoryCandidate ? getCategoryForExpenseSubcategory(subcategoryCandidate) : null;
  if (subcategoryMatch) {
    return {
      category: subcategoryMatch,
      subcategory: titleCase(subcategoryCandidate),
      resolution: 'mapped' as const,
    };
  }

  if (rawCategory) {
    const normalized = normalizeCategorySelection(rawCategory, 'expense');
    if (existingNames.has(normalized)) {
      return {
        category: normalized,
        subcategory: rawSubcategory ? titleCase(rawSubcategory) : '',
        resolution: normalizeText(normalized) === normalizeText(rawCategory) ? 'exact' as const : 'mapped' as const,
      };
    }

    const closest = findClosestCategory(rawCategory, Array.from(existingNames));
    if (closest) {
      return {
        category: closest,
        subcategory: rawSubcategory ? titleCase(rawSubcategory) : '',
        resolution: 'mapped' as const,
      };
    }
  }

  const detection = detectExpenseCategoryFromText([rawCategory, rawSubcategory, contextText].filter(Boolean).join(' '));
  if (detection) {
    return {
      category: detection.category,
      subcategory: rawSubcategory ? titleCase(rawSubcategory) : detection.subcategory,
      resolution: 'detected' as const,
    };
  }

  if (rawCategory) {
    return {
      category: titleCase(rawCategory),
      subcategory: rawSubcategory ? titleCase(rawSubcategory) : '',
      resolution: 'created' as const,
    };
  }

  return {
    category: 'Miscellaneous',
    subcategory: rawSubcategory ? titleCase(rawSubcategory) : '',
    resolution: 'fallback' as const,
  };
};

const resolveIncomeCategory = (rawCategory: string, contextText: string, existingNames: Set<string>) => {
  const exact = rawCategory ? findClosestCategory(rawCategory, Array.from(existingNames)) : null;
  if (exact) {
    return {
      category: exact,
      subcategory: '',
      resolution: normalizeText(exact) === normalizeText(rawCategory) ? 'exact' as const : 'mapped' as const,
    };
  }

  const normalizedContext = normalizeText(`${rawCategory} ${contextText}`);
  const keywordMap: Array<{ category: string; keywords: string[] }> = [
    { category: 'Salary', keywords: ['salary', 'payroll', 'payout', 'stipend'] },
    { category: 'Gift & Refund', keywords: ['refund', 'reimbursement', 'cashback', 'gift'] },
    { category: 'Investment Returns', keywords: ['interest', 'dividend', 'capital gains'] },
    { category: 'Business', keywords: ['invoice', 'client payment', 'service revenue', 'sale'] },
  ];

  for (const item of keywordMap) {
    if (item.keywords.some((keyword) => normalizedContext.includes(keyword)) && existingNames.has(item.category)) {
      return { category: item.category, subcategory: '', resolution: 'detected' as const };
    }
  }

  if (rawCategory) {
    return { category: titleCase(rawCategory), subcategory: '', resolution: 'created' as const };
  }

  return { category: 'Other Income', subcategory: '', resolution: 'fallback' as const };
};

const getCategoryCatalog = async (): Promise<ExistingCategoryCatalog> => {
  const rawCategories = await db.categories.toArray();
  const expenseNames = new Set<string>([...getExpenseCategoryNames(), ...rawCategories.filter((item) => item.type === 'expense').map((item) => item.name)]);
  const incomeNames = new Set<string>([...getIncomeCategoryNames(), ...rawCategories.filter((item) => item.type === 'income').map((item) => item.name)]);
  return { expenseNames, incomeNames, rawCategories };
};

const getFallbackAccountId = (accounts: Account[], requestedAccountId: number) => {
  if (accounts.some((account) => account.id === requestedAccountId)) return requestedAccountId;
  return accounts[0]?.id ?? 0;
};

const buildImportMetadata = (
  record: Record<string, unknown>,
  lookup: Record<string, unknown>,
  fileName: string,
) => {
  const metadata: Record<string, string> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (KNOWN_FIELD_GROUPS.includes(normalizeKey(key))) return;
    const displayValue = toDisplayValue(value);
    if (displayValue) {
      metadata[titleCase(key.replace(/[_-]+/g, ' '))] = displayValue;
    }
  });

  const paymentMethod = toDisplayValue(getFieldValue(lookup, PAYMENT_KEYS));
  const currency = toDisplayValue(getFieldValue(lookup, CURRENCY_KEYS));
  const fxRate = toDisplayValue(getFieldValue(lookup, FX_RATE_KEYS));
  const location = toDisplayValue(lookup.location);
  const tags = toDisplayValue(lookup.tags);

  if (paymentMethod) metadata['Payment Method'] = paymentMethod;
  if (currency) metadata.Currency = currency;
  if (fxRate) metadata['FX Rate'] = fxRate;
  if (location) metadata.Location = location;
  if (tags) metadata.Tags = tags;
  metadata['Source File'] = fileName;

  return metadata;
};

class SmartExpenseImportService {
  async analyzeFile(file: File, options: AnalyzeOptions): Promise<SmartImportPreview> {
    const text = await file.text();
    const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';

    if (fileType === 'json') {
      const payload = JSON.parse(text);
      if (isFinoraBackupPayload(payload)) {
        return this.buildBackupPreview(file.name, payload);
      }

      return this.buildThirdPartyPreview({
        fileName: file.name,
        fileType,
        records: extractJsonRecords(payload),
        defaultAccountId: options.defaultAccountId,
      });
    }

    return this.buildThirdPartyPreview({
      fileName: file.name,
      fileType,
      records: parseCsvRecords(text),
      defaultAccountId: options.defaultAccountId,
    });
  }

  async applyPreviewImport(options: ApplyPreviewOptions) {
    const importableRows = options.rows.filter((row) => {
      if (row.errors.length > 0) return false;
      if (options.skipDuplicates && row.duplicate) return false;
      return true;
    });

    const accountBalanceChanges = new Map<number, number>();
    const categoryCatalog = await getCategoryCatalog();
    const importedAt = new Date();
    let createdCategories: string[] = [];
    const accounts = await db.accounts.toArray();
    const accountsById = new Map(accounts.map((account) => [account.id, account]));

    const transactionsToImport: Transaction[] = importableRows.map((row) => {
      const accountCurrency = accountsById.get(row.accountId)?.currency;
      const resolvedAmount = resolveImportedAmount(row.amount, row.metadata, accountCurrency);
      const metadata = resolvedAmount !== row.amount
        ? {
            ...row.metadata,
            'Original Amount': String(row.amount),
          }
        : row.metadata;
      const description = buildDescription(row.description, metadata, options.fileName);
      const accountChange = row.transactionType === 'income' ? resolvedAmount : -resolvedAmount;
      accountBalanceChanges.set(row.accountId, (accountBalanceChanges.get(row.accountId) ?? 0) + accountChange);

      return {
        accountId: row.accountId,
        amount: resolvedAmount,
        category: row.category,
        subcategory: row.subcategory || undefined,
        description,
        merchant: row.merchant || undefined,
        date: row.date!,
        type: row.transactionType,
        createdAt: importedAt,
        importedAt,
        importSource: options.fileName,
        importMetadata: metadata,
        originalCategory: row.rawCategory || undefined,
      };
    });

    await db.transaction('rw', db.transactions, db.accounts, db.importHistories, db.categories, async () => {
      createdCategories = await this.ensureCategories(importableRows, categoryCatalog, options.userId);

      if (transactionsToImport.length > 0) {
        await db.transactions.bulkAdd(transactionsToImport);
      }

      for (const [accountId, change] of accountBalanceChanges.entries()) {
        const account = await db.accounts.get(accountId);
        if (!account) continue;
        await db.accounts.update(accountId, {
          balance: account.balance + change,
          updatedAt: importedAt,
        });
      }

      const history: ImportHistory = {
        fileName: options.fileName,
        fileType: options.fileType,
        sourceKind: 'third-party',
        totalRecords: options.rows.length,
        importedRecords: transactionsToImport.length,
        skippedRecords: options.rows.length - transactionsToImport.length,
        duplicateRecords: options.rows.filter((row) => row.duplicate).length,
        createdCategories,
        errors: options.rows
          .filter((row) => row.errors.length > 0)
          .map((row) => `Row ${row.rowNumber}: ${row.errors.join(', ')}`),
        createdAt: importedAt,
        userId: options.userId,
        metadata: {
          fallbackAccountId: options.rows[0]?.accountId,
        },
      };

      await db.importHistories.add(history);
    });

    return {
      importedCount: transactionsToImport.length,
      skippedCount: options.rows.length - transactionsToImport.length,
      createdCategories,
    };
  }

  async restoreBackup(options: RestoreBackupOptions) {
    await importDataFromJSON(options.jsonText);

    const payload = JSON.parse(options.jsonText) as Record<string, unknown>;
    await db.importHistories.add({
      fileName: options.fileName,
      fileType: 'json',
      sourceKind: 'backup',
      totalRecords: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
      importedRecords: Array.isArray(payload.transactions) ? payload.transactions.length : 0,
      skippedRecords: 0,
      duplicateRecords: 0,
      createdCategories: [],
      errors: [],
      createdAt: new Date(),
      userId: options.userId,
      metadata: {
        restoredBackup: true,
        exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined,
        version: typeof payload.version === 'string' ? payload.version : undefined,
      },
    });
  }

  private buildBackupPreview(fileName: string, payload: Record<string, unknown>): BackupImportPreview {
    const labels: Array<[string, unknown]> = [
      ['Accounts', payload.accounts],
      ['Transactions', payload.transactions],
      ['Loans', payload.loans],
      ['Goals', payload.goals],
      ['Group Expenses', payload.groupExpenses],
      ['Investments', payload.investments],
      ['Friends', payload.friends],
      ['Categories', payload.categories],
    ];

    return {
      kind: 'backup',
      fileName,
      fileType: 'json',
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : undefined,
      version: typeof payload.version === 'string' ? payload.version : undefined,
      counts: labels.map(([label, value]) => ({
        label,
        count: Array.isArray(value) ? value.length : 0,
      })),
    };
  }

  private async buildThirdPartyPreview(options: {
    fileName: string;
    fileType: ImportFileType;
    records: Array<Record<string, unknown>>;
    defaultAccountId: number;
  }): Promise<ThirdPartyImportPreview> {
    const categoryCatalog = await getCategoryCatalog();
    const existingTransactions = await db.transactions.toArray();
    const existingKeys = new Set(existingTransactions.map((transaction) =>
      buildDuplicateKey(new Date(transaction.date), Number(transaction.amount) || 0, String(transaction.description || '')),
    ));
    const accounts = await db.accounts.toArray();
    const fallbackAccountId = getFallbackAccountId(accounts, options.defaultAccountId);
    const errors: string[] = [];

    const rows = options.records.map((record, index) => {
      const lookup = buildLookup(record);
      const date = parseDateValue(getFieldValue(lookup, DATE_KEYS));
      const debitAmount = parseAmountValue(getFieldValue(lookup, AMOUNT_KEYS));
      const creditAmount = parseAmountValue(getFieldValue(lookup, CREDIT_KEYS));
      let amount = debitAmount ?? creditAmount ?? null;
      let transactionType = parseTypeValue(getFieldValue(lookup, TYPE_KEYS));

      if (!transactionType) {
        if (creditAmount != null && creditAmount > 0 && (debitAmount == null || debitAmount === 0)) transactionType = 'income';
        else if (amount != null && amount < 0) transactionType = 'expense';
        else transactionType = 'expense';
      }

      if (amount != null) amount = Math.abs(amount);

      const description = toDisplayValue(getFieldValue(lookup, DESCRIPTION_KEYS));
      const merchant = toDisplayValue(getFieldValue(lookup, MERCHANT_KEYS));
      const rawCategory = toDisplayValue(getFieldValue(lookup, CATEGORY_KEYS));
      const rawSubcategory = toDisplayValue(getFieldValue(lookup, SUBCATEGORY_KEYS));
      const paymentMethod = toDisplayValue(getFieldValue(lookup, PAYMENT_KEYS));
      const contextText = [description, merchant, rawCategory, rawSubcategory, paymentMethod].filter(Boolean).join(' ');
      const metadata = buildImportMetadata(record, lookup, options.fileName);

      const categoryResult = transactionType === 'income'
        ? resolveIncomeCategory(rawCategory, contextText, categoryCatalog.incomeNames)
        : resolveExpenseCategory(rawCategory, rawSubcategory, contextText, categoryCatalog.expenseNames);

      const rowErrors: string[] = [];
      if (!date) rowErrors.push('Invalid date');
      if (amount == null || !Number.isFinite(amount)) rowErrors.push('Invalid amount');

      const fallbackDescription = description || merchant || rawSubcategory || rawCategory || `Imported row ${index + 1}`;
      const duplicateKey = buildDuplicateKey(date, amount ?? 0, fallbackDescription);
      const duplicate = duplicateKey ? existingKeys.has(duplicateKey) : false;

      return {
        id: createRowId(index),
        rowNumber: index + 1,
        transactionType,
        accountId: fallbackAccountId,
        date,
        amount: amount ?? 0,
        description: fallbackDescription,
        merchant,
        rawCategory,
        rawSubcategory,
        category: categoryResult.category,
        subcategory: categoryResult.subcategory,
        categoryResolution: categoryResult.resolution,
        duplicateKey,
        duplicate,
        errors: rowErrors,
        metadata,
        originalData: record,
      } satisfies ImportPreviewRow;
    });

    if (rows.length === 0) {
      errors.push('No importable rows were found in this file.');
    }

    const summary = {
      totalRecords: rows.length,
      readyRecords: rows.filter((row) => row.errors.length === 0 && !row.duplicate).length,
      duplicateRecords: rows.filter((row) => row.duplicate).length,
      invalidRecords: rows.filter((row) => row.errors.length > 0).length,
      exactMatches: rows.filter((row) => row.categoryResolution === 'exact').length,
      mappedMatches: rows.filter((row) => row.categoryResolution === 'mapped').length,
      detectedMatches: rows.filter((row) => row.categoryResolution === 'detected').length,
      createdCategories: Array.from(new Set(rows
        .filter((row) => row.categoryResolution === 'created')
        .map((row) => row.category))),
    };

    return {
      kind: 'third-party',
      fileName: options.fileName,
      fileType: options.fileType,
      rows,
      errors,
      summary,
    };
  }

  private async ensureCategories(
    rows: ImportPreviewRow[],
    categoryCatalog: ExistingCategoryCatalog,
    userId?: string,
  ) {
    const seenNames = new Set([
      ...Array.from(categoryCatalog.expenseNames).map((name) => `expense::${normalizeText(name)}`),
      ...Array.from(categoryCatalog.incomeNames).map((name) => `income::${normalizeText(name)}`),
    ]);
    const createdCategories: string[] = [];
    const timestamp = new Date();

    for (const row of rows) {
      const categoryType = row.transactionType;
      const key = `${categoryType}::${normalizeText(row.category)}`;
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      const existing = categoryCatalog.rawCategories.find((item) =>
        item.type === categoryType && normalizeText(item.name) === normalizeText(row.category),
      );
      if (existing) continue;

      const details = getCategoryDetails(row.category, categoryType);
      const category: AppCategory = {
        id: `${categoryType}-${slugify(row.category)}`,
        name: row.category,
        type: categoryType,
        color: details?.color ?? (categoryType === 'expense' ? '#64748B' : '#10B981'),
        icon: details?.icon ?? (categoryType === 'expense' ? '🧾' : '💸'),
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
        createdFromImport: true,
      };

      await db.categories.put(category);
      createdCategories.push(category.name);
    }

    return createdCategories;
  }
}

export const smartExpenseImportService = new SmartExpenseImportService();
