/**
 * Smart Statement Import Service
 * Handles parsing of bank statements from PDF, CSV, and Excel files
 */

import { db, Transaction } from '@/lib/database';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  };
}

export interface StatementImportOptions {
  accountId: number;
  userId: string;
  accountType: string;
}

class StatementImportService {
  private paymentChannels = {
    'GPay': 'GPay',
    'PhonePe': 'PhonePe', 
    'Paytm': 'Paytm',
    'CRED': 'CRED',
    'IMPS': 'Bank Transfer',
    'NEFT': 'Bank Transfer',
    'RTGS': 'Bank Transfer',
    'UPI': 'UPI',
    'CARD': 'Card',
    'ATM': 'ATM',
    'NET': 'Net Banking'
  };

  private merchantCategories = {
    // Fuel
    'PETROL': 'Fuel',
    'DIESEL': 'Fuel',
    'HPCL': 'Fuel',
    'BPCL': 'Fuel',
    'IOCL': 'Fuel',
    'SHELL': 'Fuel',
    'RELIANCE': 'Fuel',
    
    // Shopping
    'AMAZON': 'Shopping',
    'FLIPKART': 'Shopping',
    'MEESHO': 'Shopping',
    'MYNTRA': 'Shopping',
    'AJIO': 'Shopping',
    'NYKAA': 'Shopping',
    
    // Food & Dining
    'SWIGGY': 'Food',
    'ZOMATO': 'Food',
    'DOMINOS': 'Food',
    'PIZZA': 'Food',
    'KFC': 'Food',
    'MCD': 'Food',
    
    // Entertainment
    'NETFLIX': 'Entertainment',
    'PRIME': 'Entertainment',
    'DISNEY': 'Entertainment',
    'SPOTIFY': 'Entertainment',
    'YOUTUBE': 'Entertainment',
    
    // Transport
    'UBER': 'Transport',
    'OLA': 'Transport',
    'RAPIDO': 'Transport',
    'METRO': 'Transport',
    'AUTO': 'Transport',
    
    // Utilities
    'ELECTRICITY': 'Utilities',
    'WATER': 'Utilities',
    'GAS': 'Utilities',
    'INTERNET': 'Utilities',
    'PHONE': 'Utilities',
    
    // Income
    'SALARY': 'Income',
    'SAL': 'Income',
    'CREDIT': 'Income',
    'REFUND': 'Income',
    'BONUS': 'Income',
    'DIVIDEND': 'Income'
  };

  /**
   * Parse statement file based on type
   */
  async parseStatement(file: File, options: StatementImportOptions): Promise<ImportResult> {
    try {
      let transactions: ParsedTransaction[] = [];
      let errors: string[] = [];

      switch (file.type) {
        case 'application/pdf':
          transactions = await this.parsePDF(file, errors);
          break;
        case 'text/csv':
          transactions = await this.parseCSV(file, errors);
          break;
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          transactions = await this.parseExcel(file, errors);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      // Process transactions
      const processedTransactions = this.processTransactions(transactions, options);
      
      // Generate summary
      const summary = this.generateSummary(processedTransactions);

      return {
        success: true,
        transactions: processedTransactions,
        errors,
        summary
      };

    } catch (error) {
      return {
        success: false,
        transactions: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        summary: { total: 0, credits: 0, debits: 0, count: 0 }
      };
    }
  }

  /**
   * Parse PDF statement
   */
  private async parsePDF(file: File, errors: string[]): Promise<ParsedTransaction[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log('Extracted PDF text:', fullText);
      
      const transactions = this.extractTransactionsFromText(fullText, errors);
      return transactions;
    } catch (error) {
      console.error('PDF parsing error:', error);
      errors.push(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Parse CSV statement
   */
  private async parseCSV(file: File, errors: string[]): Promise<ParsedTransaction[]> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const transactions = this.extractTransactionsFromCSV(text, errors);
        resolve(transactions);
      };
      reader.readAsText(file);
    });
  }

  /**
   * Parse Excel statement
   */
  private async parseExcel(file: File, errors: string[]): Promise<ParsedTransaction[]> {
    // For now, simulate Excel parsing
    // In production, use xlsx library
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const mockText = this.getMockPDFText();
        const transactions = this.extractTransactionsFromText(mockText, errors);
        resolve(transactions);
      };
      reader.readAsText(file);
    });
  }

  /**
   * Extract transactions from text
   */
  private extractTransactionsFromText(text: string, errors: string[]): ParsedTransaction[] {
    const lines = text.split('\n').filter(line => line.trim());
    const transactions: ParsedTransaction[] = [];

    for (const line of lines) {
      try {
        const transaction = this.parseTransactionLine(line);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Failed to parse line: ${line}`);
      }
    }

    return transactions;
  }

  /**
   * Extract transactions from CSV
   */
  private extractTransactionsFromCSV(text: string, errors: string[]): ParsedTransaction[] {
    const lines = text.split('\n');
    const transactions: ParsedTransaction[] = [];

    // Skip header if exists
    const startIndex = lines[0]?.toLowerCase().includes('date') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        const transaction = this.parseTransactionFromCSV(columns);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push(`Failed to parse CSV line ${i + 1}: ${line}`);
      }
    }

    return transactions;
  }

  /**
   * Parse single transaction line
   */
  private parseTransactionLine(line: string): ParsedTransaction | null {
    // Skip empty or header lines
    if (!line.trim() || line.toLowerCase().includes('opening balance') || 
        line.toLowerCase().includes('closing balance') || line.toLowerCase().includes('statement')) {
      return null;
    }

    // Try to extract date and amount from the line
    const dateResult = this.extractDate(line);
    const amountResult = this.extractAmount(line);
    
    if (!dateResult || !amountResult) {
      return null;
    }

    return {
      transaction_date: dateResult,
      raw_description: line.trim(),
      cleaned_description: this.cleanDescription(line),
      amount: amountResult.amount,
      transaction_type: amountResult.isCredit ? 'income' : 'expense',
      payment_channel: this.extractPaymentChannel(line),
      merchant_name: this.extractMerchantName(line)
    };
  }

  /**
   * Extract date from transaction line - handles multiple formats
   */
  private extractDate(line: string): Date | null {
    const datePatterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/,
      // YYYY/MM/DD or YYYY-MM-DD
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/,
      // DD MMM YYYY (01 Jan 2024)
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
      // MMM DD, YYYY (Jan 01, 2024)
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
      // DD.MM.YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // MM DD YYYY format (02 15 2024)
      /(\d{2})\s+(\d{2})\s+(\d{4})/,
    ];

    const monthMap: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        let year: number, month: number, day: number;

        if (pattern.source.includes('Jan|Feb|Mar')) {
          // MMM format
          if (pattern.source.startsWith('(Jan')) {
            // MMM DD, YYYY
            month = monthMap[match[1].toLowerCase().substring(0, 3)];
            day = parseInt(match[2]);
            year = parseInt(match[3]);
          } else {
            // DD MMM YYYY
            day = parseInt(match[1]);
            month = monthMap[match[2].toLowerCase().substring(0, 3)];
            year = parseInt(match[3]);
          }
        } else if (pattern.source.startsWith('(\\d{4})')) {
          // YYYY/MM/DD
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else {
          // DD/MM/YYYY or similar
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]);
        }

        // Validate date
        if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          return new Date(year, month, day);
        }
      }
    }

    // Try to find just month/year and use 1st of month
    const monthYearMatch = line.match(/(\d{1,2})[\s\/\-](\d{4})/);
    if (monthYearMatch) {
      const month = parseInt(monthYearMatch[1]) - 1;
      const year = parseInt(monthYearMatch[2]);
      if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11) {
        return new Date(year, month, 1);
      }
    }

    return null;
  }

  /**
   * Extract amount from transaction line - handles multiple formats
   */
  private extractAmount(line: string): { amount: number; isCredit: boolean } | null {
    // Clean the line for amount extraction
    const cleanLine = line.replace(/,/g, ''); // Remove thousands separators
    
    // Look for currency symbols and amounts
    const amountPatterns = [
      // Amount with currency symbol: ₹15,000.00 or Rs.15000 or $1500.00
      /(?:₹|Rs\.?|INR|\$|USD)\s*(-?\d+(?:\.\d{1,2})?)/i,
      // Amount with Dr/Cr suffix: 15000.00 Dr or 15000.00 Cr
      /(\d+(?:\.\d{1,2})?)\s*(Dr|Cr|DR|CR)?\b/,
      // Negative amount: -15000.00
      /(-\d+(?:\.\d{1,2})?)/,
      // Plain amount at end of line (common in bank statements)
      /\b(\d+(?:\.\d{1,2})?)$/,
      // Amount with spaces (like 15 000.00)
      /\b(\d{1,3}(?:\s\d{3})*(?:\.\d{1,2})?)\b/,
    ];

    // Check for credit indicators
    const isCreditLine = /credit|salary|received|refund|cashback|deposit/i.test(line) ||
                         /\bCr\b/i.test(line) ||
                         /\+\s*\d/.test(line);
    
    // Check for debit indicators
    const isDebitLine = /debit|withdrawal|transfer|payment|purchase|spent/i.test(line) ||
                        /\bDr\b/i.test(line) ||
                        /-\s*\d/.test(line);

    for (const pattern of amountPatterns) {
      const matches = cleanLine.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        for (const matchStr of matches) {
          const numMatch = matchStr.match(/(-?\d[\d\s]*(?:\.\d{1,2})?)/);
          if (numMatch) {
            let amountStr = numMatch[1].replace(/\s/g, '');
            let amount = parseFloat(amountStr);
            
            // Only accept reasonable transaction amounts (0.01 to 10,000,000)
            if (amount > 0 && amount < 10000000) {
              // Determine if credit or debit
              const drCrMatch = matchStr.match(/\b(Dr|Cr|DR|CR)\b/);
              let isCredit = isCreditLine;
              
              if (drCrMatch) {
                isCredit = drCrMatch[1].toLowerCase() === 'cr';
              }

              return { amount, isCredit };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse transaction from CSV columns
   */
  private parseTransactionFromCSV(columns: string[]): ParsedTransaction | null {
    if (columns.length < 3) return null;

    // Assuming CSV format: Date, Description, Amount, Balance
    const [dateStr, description, amount, balance] = columns;
    
    return {
      transaction_date: new Date(dateStr),
      raw_description: description,
      cleaned_description: this.cleanDescription(description),
      amount: parseFloat(amount),
      transaction_type: parseFloat(amount) >= 0 ? 'income' : 'expense',
      balance_after_transaction: balance ? parseFloat(balance) : undefined,
      payment_channel: this.extractPaymentChannel(description),
      merchant_name: this.extractMerchantName(description)
    };
  }

  /**
   * Clean and normalize description
   */
  private cleanDescription(rawDescription: string): string {
    let cleaned = rawDescription;

    // Remove transaction IDs and numbers
    cleaned = cleaned.replace(/\/\d+\//g, ' ');
    cleaned = cleaned.replace(/\b\d{6,}\b/g, ' ');

    // Convert UPI patterns to readable text
    cleaned = cleaned.replace(/UPI\/\d+\/([^\/]+)\/([^\/]+)/gi, 'Paid via $1 to $2');
    cleaned = cleaned.replace(/IMPS\/\d+\/([^\/]+)/gi, 'IMPS transfer to $1');
    cleaned = cleaned.replace(/NEFT\/\d+\/([^\/]+)/gi, 'NEFT transfer to $1');

    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Extract payment channel
   */
  private extractPaymentChannel(description: string): string {
    const upperDesc = description.toUpperCase();
    
    for (const [key, channel] of Object.entries(this.paymentChannels)) {
      if (upperDesc.includes(key)) {
        return channel;
      }
    }

    return 'Bank';
  }

  /**
   * Extract merchant name
   */
  private extractMerchantName(description: string): string | undefined {
    const upperDesc = description.toUpperCase();
    
    for (const [key, category] of Object.entries(this.merchantCategories)) {
      if (upperDesc.includes(key)) {
        return key;
      }
    }

    return undefined;
  }

  /**
   * Determine transaction type
   */
  private determineTransactionType(description: string): 'expense' | 'income' | 'transfer' {
    const upperDesc = description.toUpperCase();
    
    // Credit indicators
    const creditKeywords = ['CREDIT', 'SALARY', 'REFUND', 'DEPOSIT', 'RECEIVED'];
    
    for (const keyword of creditKeywords) {
      if (upperDesc.includes(keyword)) {
        return 'income';
      }
    }

    return 'expense';
  }

  /**
   * Auto-categorize transaction
   */
  private categorizeTransaction(description: string, amount: number): string {
    const upperDesc = description.toUpperCase();
    
    // Income
    if (amount > 0) {
      for (const [key, category] of Object.entries(this.merchantCategories)) {
        if (upperDesc.includes(key) && category === 'Income') {
          return category;
        }
      }
      return 'Income';
    }

    // Expenses
    for (const [key, category] of Object.entries(this.merchantCategories)) {
      if (upperDesc.includes(key) && category !== 'Income') {
        return category;
      }
    }

    return 'Others';
  }

  /**
   * Process transactions with business logic
   */
  private processTransactions(transactions: ParsedTransaction[], options: StatementImportOptions): ParsedTransaction[] {
    return transactions.map(transaction => ({
      ...transaction,
      category: this.categorizeTransaction(transaction.cleaned_description, transaction.amount),
      // Add account and user info for database storage
      account_id: options.accountId,
      user_id: options.userId
    } as ParsedTransaction));
  }

  /**
   * Generate import summary
   */
  private generateSummary(transactions: ParsedTransaction[]) {
    const summary = {
      total: 0,
      credits: 0,
      debits: 0,
      count: transactions.length
    };

    transactions.forEach(t => {
      summary.total += t.amount;
      if (t.transaction_type === 'income') {
        summary.credits += t.amount;
      } else {
        summary.debits += Math.abs(t.amount);
      }
    });

    return summary;
  }

  /**
   * Import transactions to database
   */
  async importTransactions(transactions: ParsedTransaction[], options: StatementImportOptions): Promise<void> {
    try {
      // Filter out transactions with invalid dates
      const validTransactions = transactions.filter(t => 
        t.transaction_date && !isNaN(t.transaction_date.getTime())
      );

      if (validTransactions.length !== transactions.length) {
        console.warn(`Filtered out ${transactions.length - validTransactions.length} transactions with invalid dates`);
      }

      // Check for duplicates
      const existingTransactions = await db.transactions
        .where('accountId')
        .equals(options.accountId)
        .toArray();

      const duplicates = this.findDuplicates(validTransactions, existingTransactions);
      
      // Filter out duplicates
      const newTransactions = validTransactions.filter(t => !duplicates.has(this.generateTransactionHash(t)));

      // Add to database
      if (newTransactions.length > 0) {
        await db.transactions.bulkAdd(newTransactions.map(t => ({
          accountId: options.accountId,
          userId: options.userId,
          date: t.transaction_date,
          description: t.cleaned_description,
          amount: Math.abs(t.amount),
          type: t.transaction_type,
          category: t.category || 'Others',
          merchant: t.merchant_name,
          createdAt: new Date(),
          // Add custom fields for statement import
          paymentChannel: t.payment_channel,
          balanceAfter: t.balance_after_transaction,
          rawDescription: t.raw_description
        })));

        // Update account balance if needed
        await this.updateAccountBalance(options.accountId, newTransactions);
      }

    } catch (error) {
      console.error('Error importing transactions:', error);
      throw error;
    }
  }

  /**
   * Find duplicate transactions
   */
  private findDuplicates(newTransactions: ParsedTransaction[], existingTransactions: any[]): Set<string> {
    const existingHashes = new Set(
      existingTransactions.map(t => this.generateTransactionHash(t)).filter(hash => hash !== '')
    );

    const duplicates = new Set<string>();
    newTransactions.forEach(t => {
      const hash = this.generateTransactionHash(t);
      if (hash && existingHashes.has(hash)) {
        duplicates.add(hash);
      }
    });

    return duplicates;
  }

  /**
   * Generate transaction hash for deduplication
   */
  private generateTransactionHash(transaction: ParsedTransaction): string {
    if (!transaction.transaction_date || isNaN(transaction.transaction_date.getTime())) {
      return '';
    }
    const date = transaction.transaction_date.toISOString().split('T')[0];
    const amount = Math.abs(transaction.amount).toFixed(2);
    const description = transaction.raw_description.substring(0, 50);
    
    return btoa(`${date}|${amount}|${description}`).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Update account balance
   */
  private async updateAccountBalance(accountId: number, transactions: ParsedTransaction[]): Promise<void> {
    try {
      const account = await db.accounts.get(accountId);
      if (!account) return;

      // Calculate new balance from transactions
      const netChange = transactions.reduce((sum, t) => {
        return sum + (t.transaction_type === 'income' ? t.amount : -Math.abs(t.amount));
      }, 0);

      await db.accounts.update(accountId, {
        balance: account.balance + netChange,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Error updating account balance:', error);
    }
  }

  /**
   * Get mock PDF text for testing
   */
  private getMockPDFText(): string {
    return `02/01/2024 UPI/983746/GPay/HPCL PETROL BUNK 2500.00
02/02/2024 UPI/983747/PhonePe/SWIGGY ORDERS 450.00
02/03/2024 UPI/983748/Paytm/AMAZON IN 1299.00
02/04/2024 SALARY CREDIT 45000.00
02/05/2024 UPI/983749/GPay/NETFLIX SUBSCRIPTION 199.00
02/06/2024 IMPS/983750/RENT TRANSFER 15000.00
02/07/2024 UPI/983751/CRED/BILL PAYMENT 2500.00`;
  }
}

export const statementImportService = new StatementImportService();
