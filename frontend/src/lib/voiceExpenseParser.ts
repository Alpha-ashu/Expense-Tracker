export type VoiceIntent = 'expense' | 'income' | 'transfer';

export interface VoiceParseResult {
  intent: VoiceIntent;
  amount: number | null;
  category: string | null;
  description: string;
}

const expenseCategoryRules: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['food', 'lunch', 'dinner', 'breakfast', 'groceries', 'grocery', 'restaurant', 'cafe', 'kfc', 'pizza', 'burger', 'mcdonald', 'swiggy', 'zomato', 'foodpanda', 'delivery'], category: 'Food & Dining' },
  { keywords: ['rent', 'maintenance'], category: 'Utilities' },
  { keywords: ['uber', 'ola', 'auto', 'cab', 'taxi', 'travel', 'bus', 'train', 'metro', 'fuel', 'petrol', 'diesel', 'gas'], category: 'Transportation' },
  { keywords: ['flight', 'hotel', 'trip', 'vacation', 'tour', 'airbnb', 'booking', 'hostel'], category: 'Travel' },
  { keywords: ['shopping', 'clothes', 'dress', 'shoes', 'amazon', 'flipkart', 'myntra', 'ajio', 'apparel'], category: 'Shopping' },
  { keywords: ['emi', 'loan', 'installment', 'payment'], category: 'Financial' },
  { keywords: ['bill', 'electricity', 'water', 'gas', 'utility', 'internet', 'phone', 'mobile', 'broadband', 'wifi'], category: 'Utilities' },
  { keywords: ['doctor', 'medicine', 'pharmacy', 'hospital', 'dental', 'clinic', 'medical', 'health'], category: 'Healthcare' },
  { keywords: ['gym', 'fitness', 'workout', 'yoga', 'trainer', 'sports', 'exercise'], category: 'Fitness & Sports' },
  { keywords: ['netflix', 'spotify', 'prime', 'hotstar', 'subscription', 'app', 'streaming', 'music', 'movie'], category: 'Entertainment' },
  { keywords: ['gift', 'birthday', 'wedding', 'present', 'donation', 'charity'], category: 'Gifts & Donations' },
  { keywords: ['education', 'course', 'book', 'tuition', 'class', 'school', 'college', 'udemy', 'coursera'], category: 'Education' },
  { keywords: ['salon', 'haircut', 'spa', 'beauty', 'grooming', 'barber'], category: 'Personal Care' },
  { keywords: ['office', 'client', 'software', 'tools', 'meeting', 'business', 'work'], category: 'Work & Business' },
  { keywords: ['pet', 'vet', 'veterinary', 'pet food', 'grooming'], category: 'Pets' },
  { keywords: ['misc', 'miscellaneous', 'other', 'uncategorized'], category: 'Miscellaneous' },
];

const incomeCategoryRules: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['salary', 'payroll', 'paycheck', 'pay cheque', 'wages', 'stipend'], category: 'Salary' },
  { keywords: ['freelance', 'gig', 'side gig', 'consulting', 'contract', 'project', 'client payment'], category: 'Freelance & Side Gigs' },
  { keywords: ['interest', 'dividend', 'capital gains', 'stock', 'mutual fund', 'bond', 'crypto', 'staking'], category: 'Investment Returns' },
  { keywords: ['business', 'sale', 'revenue', 'service', 'rental', 'rent received', 'royalty', 'affiliate', 'sponsorship'], category: 'Business' },
  { keywords: ['refund', 'reimbursement', 'cashback', 'tax return', 'gst', 'claim', 'insurance payout', 'gift received'], category: 'Gift & Refund' },
  { keywords: ['bonus', 'award', 'inheritance', 'settlement', 'scholarship', 'pension', 'borrowed', 'loan received'], category: 'Other Income' },
];

const transferKeywords = ['transfer', 'moved', 'send', 'sent', 'to savings', 'to wallet', 'to bank', 'from savings', 'from bank', 'shifted'];
const incomeKeywords = ['salary', 'received', 'got', 'income', 'refund', 'reimbursement', 'cashback', 'gst', 'tax return', 'claim', 'bonus', 'interest', 'dividend', 'borrowed', 'credited', 'loan received', 'gift received'];
const expenseKeywords = ['spent', 'spend', 'bought', 'buy', 'paid', 'pay', 'purchase', 'petrol', 'fuel', 'food', 'grocery', 'rent', 'movie', 'mobile', 'bill', 'charge', 'fee'];

const numberWords: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const decimalWords: Record<string, number> = { half: 0.5, quarter: 0.25 };

function wordsToNumber(text: string): number | null {
  const tokens = text.replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  let total = 0, current = 0, matched = false, decimal = 0, afterPoint = false;

  for (const token of tokens) {
    if (token === 'and') continue;
    if (token === 'point') { afterPoint = true; matched = true; continue; }
    if (afterPoint) {
      const value = numberWords[token];
      if (value !== undefined && value < 10) { decimal = decimal * 10 + value; matched = true; }
      continue;
    }

    const decimalValue = decimalWords[token];
    if (decimalValue !== undefined) return (total + current) + decimalValue;

    if (token === 'hundred') { if (current === 0) current = 1; current *= 100; matched = true; continue; }
    if (token === 'thousand') { if (current === 0) current = 1; total += current * 1000; current = 0; matched = true; continue; }
    if (token === 'lakh') { if (current === 0) current = 1; total += current * 100000; current = 0; matched = true; continue; }
    if (token === 'crore') { if (current === 0) current = 1; total += current * 10000000; current = 0; matched = true; continue; }

    const value = numberWords[token];
    if (value !== undefined) { current += value; matched = true; }
  }

  if (!matched) return null;
  let result = total + current;
  if (decimal > 0) result += decimal / Math.pow(10, decimal.toString().length);
  return result;
}

function detectCategory(text: string, intent: VoiceIntent): string | null {
  const lowerText = text.toLowerCase();
  const rules = intent === 'income' ? incomeCategoryRules : expenseCategoryRules;
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => lowerText.includes(keyword))) return rule.category;
  }
  return null;
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

function detectIntent(text: string): VoiceIntent {
  const lowerText = text.toLowerCase();
  if (transferKeywords.some((keyword) => lowerText.includes(keyword))) return 'transfer';

  const incomeScore = countMatches(lowerText, incomeKeywords);
  const expenseScore = countMatches(lowerText, expenseKeywords);

  if (incomeScore > expenseScore) return 'income';
  if (expenseScore > incomeScore) return 'expense';

  if (detectCategory(lowerText, 'income')) return 'income';
  if (detectCategory(lowerText, 'expense')) return 'expense';

  return 'expense';
}

function extractAmountFromChunk(chunk: string): { amount: number | null; description: string } {
  const text = chunk.trim();
  const amountMatch = text.match(/(?:\b|\u20B9)(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
  let amount: number | null = null, description = text;

  if (amountMatch) {
    amount = Number(amountMatch[1].replace(/,/g, ''));
    description = text.replace(amountMatch[0], '').trim();
  } else {
    const wordAmount = wordsToNumber(text);
    if (wordAmount !== null) {
      amount = wordAmount;
      const allWords = [...Object.keys(numberWords), ...Object.keys(decimalWords), 'hundred', 'thousand', 'lakh', 'crore', 'point', 'and'];
      const tokens = text.toLowerCase().split(/\s+/);
      let lastNumberIndex = -1;
      tokens.forEach((token, i) => { if (allWords.includes(token)) lastNumberIndex = i; });
      if (lastNumberIndex >= 0) description = tokens.slice(lastNumberIndex + 1).join(' ').trim();
    }
  }

  return { amount, description };
}

export function parseMultipleTransactions(rawText: string): VoiceParseResult[] {
  const text = rawText.toLowerCase().trim();
  const chunks = text.split(/\band\b|,|\.(?!\d)|;/i).map((s) => s.trim()).filter((s) => s.length > 0);

  return chunks
    .map((chunk) => {
      const { amount, description } = extractAmountFromChunk(chunk);
      if (amount === null) return null;
      const intent = detectIntent(chunk);
      const category = intent === 'transfer' ? 'Transfer' : detectCategory(chunk, intent);
      return { intent, amount, category, description: description || chunk };
    })
    .filter((result) => result !== null) as VoiceParseResult[];
}

export function parseMultipleExpenses(rawText: string): Array<Omit<VoiceParseResult, 'intent'> & { intent: 'expense' }> {
  return parseMultipleTransactions(rawText)
    .filter((item) => item.intent === 'expense')
    .map((item) => ({ ...item, intent: 'expense' as const }));
}

export function parseVoiceExpense(rawText: string): VoiceParseResult {
  const text = rawText.toLowerCase().trim();
  const intent: VoiceIntent = detectIntent(text);
  const amountMatch = text.match(/(?:\b|\u20B9)(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : wordsToNumber(text);
  const category = intent === 'transfer' ? 'Transfer' : detectCategory(text, intent);
  return { intent, amount, category, description: rawText.trim() };
}
