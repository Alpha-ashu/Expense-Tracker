export type VoiceIntent = 'expense' | 'transfer';

export interface VoiceParseResult {
  intent: VoiceIntent;
  amount: number | null;
  category: string | null;
  description: string;
}

const categoryRules: Array<{ keywords: string[]; category: string }> = [
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
];

const transferKeywords = ['transfer', 'moved', 'send', 'sent', 'to savings', 'to bank'];

const numberWords: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const decimalWords: Record<string, number> = {
  half: 0.5,
  quarter: 0.25,
};

function wordsToNumber(text: string): number | null {
  const tokens = text
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;
  let current = 0;
  let matched = false;
  let decimal = 0;
  let afterPoint = false;

  for (const token of tokens) {
    if (token === 'and') {
      continue;
    }

    if (token === 'point') {
      afterPoint = true;
      matched = true;
      continue;
    }

    if (afterPoint) {
      const value = numberWords[token];
      if (value !== undefined && value < 10) {
        decimal = decimal * 10 + value;
        matched = true;
      }
      continue;
    }

    const decimalValue = decimalWords[token];
    if (decimalValue !== undefined) {
      return (total + current) + decimalValue;
    }

    if (token === 'hundred') {
      if (current === 0) current = 1;
      current *= 100;
      matched = true;
      continue;
    }

    if (token === 'thousand') {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      matched = true;
      continue;
    }

    if (token === 'lakh') {
      if (current === 0) current = 1;
      total += current * 100000;
      current = 0;
      matched = true;
      continue;
    }

    if (token === 'crore') {
      if (current === 0) current = 1;
      total += current * 10000000;
      current = 0;
      matched = true;
      continue;
    }

    const value = numberWords[token];
    if (value !== undefined) {
      current += value;
      matched = true;
    }
  }

  if (!matched) return null;
  
  let result = total + current;
  
  if (decimal > 0) {
    const decimalPlaces = decimal.toString().length;
    result += decimal / Math.pow(10, decimalPlaces);
  }
  
  return result;
}

export function parseVoiceExpense(rawText: string): VoiceParseResult {
  const text = rawText.toLowerCase().trim();

  const intent: VoiceIntent = transferKeywords.some((keyword) => text.includes(keyword))
    ? 'transfer'
    : 'expense';

  const amountMatch = text.match(/(?:\b|\u20B9)(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?/);
  const amount = amountMatch
    ? Number(amountMatch[1].replace(/,/g, ''))
    : wordsToNumber(text);

  let category: string | null = null;
  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      category = rule.category;
      break;
    }
  }

  return {
    intent,
    amount,
    category,
    description: rawText.trim(),
  };
}
