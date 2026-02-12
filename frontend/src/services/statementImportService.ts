/**
 * Smart Statement Import Service
 * Handles parsing of bank statements from PDF, CSV, and Excel files
 */

import { db, Transaction } from '@/lib/database';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Configure PDF.js worker from local public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// We're disabling standard font loading here because it causes issues in some environments.
// PDF.js will fall back to system fonts or embedded fonts which usually works for text extraction.
// If needed, delete the line below or make sure the detailed path is perfectly correct.
// pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = '/standard_fonts/'; 


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
      // Use disableFontFace to prevent font loading errors during text extraction
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        disableFontFace: true
      }).promise;
      
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Use simpler getTextContent call to avoid font issues
        const textContent = await page.getTextContent({
           disableCombineTextItems: false,
           includeMarkedContent: false
        });
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      // console.log('Extracted PDF text:', fullText);
      
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
    const transactions: ParsedTransaction[] = [];
    
    // For PDF text that comes as continuous string, split by date patterns
    // Common date patterns: DD-MM-YYYY, DD/MM/YYYY, DD MM YYYY
    const datePattern = /(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi;
    
    // Find all date occurrences to split the text into transaction segments
    const dateMatches = [...text.matchAll(datePattern)];
    
    if (dateMatches.length > 0) {
      // Process each segment starting with a date
      for (let i = 0; i < dateMatches.length; i++) {
        const startIdx = dateMatches[i].index!;
        // The end index is the start of the next date match, OR the end of text
        const endIdx = i < dateMatches.length - 1 ? dateMatches[i + 1].index! : text.length;
        
        let segment = text.substring(startIdx, endIdx).trim();
        
        // Clean up: remove "Page x of y" artifacts if they got stuck inside
        segment = segment.replace(/Page\s+\d+\s+of\s+\d+/gi, ' ');
        
        // Skip header rows and non-transaction segments
        if (this.isSkippableSegment(segment)) {
          continue;
        }

        // Special handling for rows that might be table headers but start with date (unlikely but possible)
        // If segment is very short (< 15 chars), skip
        if (segment.length < 15) continue;
        
        try {
          const transaction = this.parseTransactionSegment(segment);
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          errors.push(`Failed to parse segment: ${segment.substring(0, 50)}...`);
        }
      }
    } else {
      // Fallback: try line-by-line parsing
      const lines = text.split('\n').filter(line => line.trim());
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
    }

    return transactions;
  }

  /**
   * Check if a segment should be skipped (headers, footers, etc.)
   */
  private isSkippableSegment(segment: string): boolean {
    const skipPatterns = [
      /closing\s*balance/i,
      /brought\s*forward/i,
      /carried\s*forward/i,
      /statement\s*period/i,
      /txn\s*date/i,
      /transaction\s*date/i,
      /date\s*of\s*statement/i,
      /account\s*statement/i,
      /page\s*\d+/i,
      /^date\s+description/i,
      /total\s*debits/i,
      /total\s*credits/i,
    ];
    
    return skipPatterns.some(pattern => pattern.test(segment));
  }

  /**
   * Parse a transaction segment (text between two dates)
   */
  private parseTransactionSegment(segment: string): ParsedTransaction | null {
    // Extract the date from the beginning
    const dateResult = this.extractDate(segment);
    if (!dateResult) return null;
    
    // Extract amounts - look for number patterns
    const amounts = this.extractAmountsFromSegment(segment);
    if (!amounts || amounts.length === 0) return null;
    
    // Get description (text between date and first amount)
    const description = this.extractDescriptionFromSegment(segment);
    
    // Determine transaction type and amount
    // In bank statements: Debit column = expense, Credit column = income
    let amount = amounts[0];
    let isCredit = false;
    
    // Check if this looks like a credit transaction
    if (/salary|credit|deposit|received|refund|cashback|cr(?:\.|\s|$)|opening\s*balance/i.test(segment)) {
      isCredit = true;
    }
    
    // Explicitly check for "dr" or "debit"
    if (/dr(?:\.|\s|$)|debit/i.test(segment)) {
      isCredit = false;
    }
    
    // Heuristic: If description contains "payment" or "purchase" or "sent" -> Expense
    if (/payment|purchase|sent|paid|withdrawn|to\s/i.test(segment) && !/reversal|refund/i.test(segment)) {
      isCredit = false;
    }

    // Default to expense if ambiguous, unless amount implies credit (not reliable without balance math)
    
    // If there are multiple amounts (debit, credit, balance columns)
    // Common pattern: [amount] [balance]
    // If balance > amount, or balance < amount, usually amount is first number found in the segment after the date.
    if (amounts.length >= 2) {
      // Default to first amount found as transaction amount
      amount = amounts[0];
      
      // If we are very confident the second number is balance (e.g. it's explicitly labeled or much larger and at end)
      // But simple heuristic: Bank statements are chronologically listed. 
      // Amount is usually the first monetary value after description.
    }
    
    const cleanedDescription = this.cleanDescription(segment);
    // Prefer extracted description if available, else clean the whole segment
    const finalDescription = description || cleanedDescription;
    
    // Ensure amount is signed correctly based on type
    const finalAmount = Math.abs(amount);

    return {
      transaction_date: dateResult,
      raw_description: segment.trim(),
      cleaned_description: finalDescription,
      amount: finalAmount,
      transaction_type: isCredit ? 'income' : 'expense',
      payment_channel: this.extractPaymentChannel(segment),
      merchant_name: this.extractMerchantName(segment)
    };
  }



  /**
   * Extract amounts from a segment
   */
  private extractAmountsFromSegment(segment: string): number[] {
    const amounts: number[] = [];
    
    // Remove date from segment to avoid picking it as amount
    const withoutDate = segment.replace(/\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}/g, '');
    
    // Find all number patterns (with optional thousands separator and decimal)
    const amountPattern = /(?:₹|Rs\.?|INR)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;
    let match;
    
    while ((match = amountPattern.exec(withoutDate)) !== null) {
      const fullMatch = match[0];
      const numStr = match[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      
      // Get the index where the actual number starts (skipping matched whitespace/currency)
      // This is crucial because match.index points to start of *pattern* (including leading space)
      const numStartOffset = fullMatch.indexOf(match[1]);
      const actualNumberIdx = match.index + numStartOffset;

      // Check if char before is alphanumeric (like A-Z or 0-9) - indicates part of ID
      const charBefore = actualNumberIdx > 0 ? withoutDate[actualNumberIdx - 1] : '';
      const isAttachedToWord = /[a-zA-Z0-9]/.test(charBefore);

      // Filter out unreasonable amounts and likely reference numbers
      if (!isAttachedToWord && num > 0 && num < 10000000 && !this.isLikelyRefNumber(withoutDate, actualNumberIdx, num)) {
        amounts.push(num);
      }
    }
    
    return amounts;
  }

  /**
   * Check if a number is likely a reference number rather than amount
   */
  private isLikelyRefNumber(fullText: string, index: number, num: number): boolean {
    // extract text before the number
    const contextBefore = fullText.substring(0, index);
    
    // Check if preceded by Ref/Txn identifiers
    if (/(?:ref|txn|id|no\.|number|upi|imps|neft)[\s:\-]*$/i.test(contextBefore)) {
      return true;
    }
    
    // Check if the number looks like a date component (e.g. year 2024, 2025) 
    // and is close to other date components, although we stripped dates earlier
    // But sometimes partial dates remain.
    
    // Numbers longer than 8 digits with no decimal are likely ref numbers
    if (String(num).length > 8 && !String(num).includes('.')) {
      return true;
    }

    // Check if it looks like a year (2020-2030) and is not clearly a currency amount
    // And also check we don't accidentally filter out legitimate amounts like 2026
    if (num >= 2000 && num <= 2035 && Number.isInteger(num)) {
       // It could be a year.
       // If it has decimal like 2026.50, it's money. Checked by isInteger.
       
       // Check context: if preceded by "year" or "date" or just looks like a year in a date string
       // But wait, we stripped dates earlier. However, sometimes dates are in description too.
       // Let's be careful. If it looks like a year, treated as ref unless valid amount context (currency symbol).
       const hasCurrencySymbol = contextBefore.trim().match(/[₹$€£Rs\.?]/);
       if (!hasCurrencySymbol) {
         return true; // Treat standalone 2026 as year/ref
       }
    }
    
    return false;
  }

  /**
   * Extract description from segment
   */
  private extractDescriptionFromSegment(segment: string): string {
    // Remove date from beginning
    let desc = segment.replace(/^\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4}\s*/i, '');
    
    // Remove amounts from end
    desc = desc.replace(/\s*[\d,]+(?:\.\d{1,2})?\s*$/g, '');
    desc = desc.replace(/\s*[\d,]+(?:\.\d{1,2})?\s*$/g, '');
    desc = desc.replace(/\s*[\d,]+(?:\.\d{1,2})?\s*$/g, '');
    
    // Remove reference numbers
    desc = desc.replace(/\s*TXN\d+\s*/gi, ' ');
    desc = desc.replace(/\s*Ref\.?\s*:?\s*\w+/gi, ' ');
    
    // Clean up
    desc = desc.replace(/\s+/g, ' ').trim();
    
    return desc || 'Transaction';
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
  private generateTransactionHash(transaction: ParsedTransaction | any): string {
    // Handle property differences between ParsedTransaction and DB Transaction schema
    // ParsedTransaction: transaction_date, raw_description
    // DB Transaction: date, rawDescription (or description)
    const tDate = transaction.transaction_date || transaction.date;
    const tRawDesc = transaction.raw_description || transaction.rawDescription;
    // Fallback to cleaned description if raw is missing (legacy records)
    const tDesc = tRawDesc || transaction.description || '';
    
    if (!tDate) {
      return '';
    }
    
    // Ensure we have a valid date object
    const dateObj = tDate instanceof Date ? tDate : new Date(tDate);
    if (isNaN(dateObj.getTime())) {
      return '';
    }

    const date = dateObj.toISOString().split('T')[0];
    const amount = Math.abs(transaction.amount).toFixed(2);
    
    // Create normalized description string for fuzzy matching
    // 1. Convert to lowercase
    // 2. Replace multiple spaces with single space
    // 3. Remove all non-alphanumeric characters (ignore punctuation differences)
    // 4. Take first 50 chars which usually contain the merchant info
    const description = String(tDesc)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 50);
    
    // Using base64 to keep the hash clean, but the content is what matters
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
