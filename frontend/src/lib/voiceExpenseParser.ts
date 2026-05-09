export type VoiceIntent = 'expense' | 'income' | 'transfer' | 'goal' | 'group' | 'investment';

export type VoiceInvestmentKind = 'stocks' | 'crypto' | 'gold' | 'mutual-funds' | 'bonds' | 'other';

export interface VoiceParseResult {
  intent: VoiceIntent;
  amount: number | null;
  category: string | null;
  description: string;
  confidence: number;
  date?: string | null;
}

const expenseCategoryRules: Array<{ keywords: string[]; category: string }> = [
  { 
    keywords: ['food', 'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'snacks', 'groceries', 'grocery', 'restaurant', 'cafe', 'coffee', 'tea', 'kfc', 'pizza', 'burger', 'mcdonald', 'mcdonalds', 'swiggy', 'zomato', 'foodpanda', 'delivery', 'ubereats', 'doordash', 'grubhub', 'dominos', 'subway', 'starbucks', 'dunkin', 'chipotle', 'taco', 'sushi', 'ramen', 'noodles', 'pasta', 'sandwich', 'salad', 'dessert', 'ice cream', 'bakery', 'meal', 'eat', 'ate', 'eating', 'dine', 'dining'], 
    category: 'Food & Dining' 
  },
  { 
    keywords: ['uber', 'ola', 'lyft', 'auto', 'cab', 'taxi', 'travel', 'bus', 'train', 'metro', 'subway', 'fuel', 'petrol', 'diesel', 'gas', 'gasoline', 'parking', 'toll', 'bike', 'scooter', 'ride', 'commute', 'transport', 'rickshaw', 'tram', 'ferry'], 
    category: 'Transportation' 
  },
  { 
    keywords: ['flight', 'flights', 'airline', 'hotel', 'hotels', 'trip', 'vacation', 'holiday', 'tour', 'airbnb', 'booking', 'hostel', 'resort', 'cruise', 'luggage', 'visa', 'passport', 'travel insurance', 'accommodation', 'stay', 'lodging'], 
    category: 'Travel' 
  },
  { 
    keywords: ['shopping', 'shop', 'clothes', 'clothing', 'dress', 'shirt', 'pants', 'jeans', 'shoes', 'sneakers', 'boots', 'amazon', 'flipkart', 'myntra', 'ajio', 'apparel', 'fashion', 'accessories', 'jewelry', 'watch', 'bag', 'purse', 'wallet', 'sunglasses', 'hat', 'belt', 'socks', 'underwear', 'jacket', 'coat', 'sweater'], 
    category: 'Shopping' 
  },
  { 
    keywords: ['emi', 'loan', 'installment', 'payment', 'credit card', 'card payment', 'debt', 'mortgage', 'bank fee', 'bank charge', 'interest', 'finance charge', 'late fee', 'overdraft', 'loan repayment'], 
    category: 'Financial' 
  },
  { 
    keywords: ['rent', 'maintenance', 'bill', 'bills', 'electricity', 'electric', 'power', 'water', 'gas', 'utility', 'utilities', 'internet', 'wifi', 'broadband', 'phone', 'mobile', 'telephone', 'cable', 'tv', 'streaming', 'insurance', 'home insurance', 'property tax'], 
    category: 'Utilities' 
  },
  { 
    keywords: ['doctor', 'doctors', 'medicine', 'medicines', 'pharmacy', 'drug', 'drugs', 'hospital', 'clinic', 'dental', 'dentist', 'teeth', 'medical', 'health', 'healthcare', 'checkup', 'consultation', 'prescription', 'surgery', 'treatment', 'therapy', 'physical therapy', 'lab test', 'x-ray', 'scan', 'mri', 'vaccination', 'vaccine', 'vitamins', 'supplements'], 
    category: 'Healthcare' 
  },
  { 
    keywords: ['gym', 'fitness', 'workout', 'exercise', 'yoga', 'trainer', 'personal trainer', 'sports', 'sport', 'athletic', 'swimming', 'tennis', 'basketball', 'football', 'soccer', 'cricket', 'badminton', 'running', 'jogging', 'cycling', 'bicycle', 'marathon', 'fitness center', 'health club', 'pilates', 'crossfit', 'martial arts', 'boxing', 'dance', 'zumba'], 
    category: 'Fitness & Sports' 
  },
  { 
    keywords: ['netflix', 'spotify', 'prime', 'amazon prime', 'hotstar', 'disney', 'hulu', 'subscription', 'subscriptions', 'app', 'streaming', 'music', 'movie', 'movies', 'cinema', 'theater', 'theatre', 'concert', 'show', 'event', 'festival', 'amusement park', 'zoo', 'museum', 'game', 'games', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam', 'entertainment', 'hobby'], 
    category: 'Entertainment' 
  },
  { 
    keywords: ['gift', 'gifts', 'birthday', 'anniversary', 'wedding', 'present', 'donation', 'donations', 'charity', 'contribute', 'contribution', 'flowers', 'bouquet', 'card', 'greeting card', 'wrapping', 'celebrate', 'celebration'], 
    category: 'Gifts & Donations' 
  },
  { 
    keywords: ['education', 'school', 'college', 'university', 'course', 'courses', 'book', 'books', 'textbook', 'tuition', 'class', 'classes', 'lesson', 'lessons', 'udemy', 'coursera', 'skillshare', 'training', 'workshop', 'seminar', 'certification', 'exam', 'test', 'fees', 'school supplies', 'stationery', 'notebook', 'pen', 'pencil', 'backpack'], 
    category: 'Education' 
  },
  { 
    keywords: ['salon', 'haircut', 'hairstyle', 'barber', 'spa', 'massage', 'facial', 'manicure', 'pedicure', 'beauty', 'grooming', 'cosmetics', 'makeup', 'skincare', 'perfume', 'cologne', 'shampoo', 'conditioner', 'soap', 'lotion', 'cream', 'shaving', 'waxing', 'threading'], 
    category: 'Personal Care' 
  },
  { 
    keywords: ['office', 'work', 'business', 'client', 'meeting', 'conference', 'software', 'tools', 'equipment', 'supplies', 'stationery', 'printer', 'ink', 'paper', 'laptop', 'computer', 'mouse', 'keyboard', 'desk', 'chair', 'license', 'professional', 'coworking', 'workspace'], 
    category: 'Work & Business' 
  },
  { 
    keywords: ['pet', 'pets', 'dog', 'cat', 'puppy', 'kitten', 'vet', 'veterinary', 'pet food', 'dog food', 'cat food', 'pet supplies', 'pet store', 'grooming', 'pet grooming', 'pet toys', 'leash', 'collar', 'cage', 'litter', 'aquarium', 'fish'], 
    category: 'Pets' 
  },
  { 
    keywords: ['electronics', 'mobile', 'phone', 'smartphone', 'tablet', 'ipad', 'laptop', 'computer', 'tv', 'television', 'speaker', 'headphones', 'earphones', 'charger', 'cable', 'adapter', 'camera', 'appliance', 'appliances', 'refrigerator', 'washing machine', 'microwave', 'oven', 'ac', 'air conditioner', 'fan', 'heater', 'vacuum', 'blender', 'furniture', 'sofa', 'bed', 'table', 'chair', 'mattress', 'curtain', 'decor', 'decoration', 'home', 'household'], 
    category: 'Shopping' 
  },
  { 
    keywords: ['misc', 'miscellaneous', 'other', 'others', 'uncategorized', 'general', 'random', 'various', 'stuff', 'things', 'item', 'items'], 
    category: 'Miscellaneous' 
  },
];

const incomeCategoryRules: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['salary', 'payroll', 'paycheck', 'pay cheque', 'wages', 'stipend', 'wage', 'pay', 'income', 'earnings', 'remuneration', 'compensation', 'allowance', 'monthly pay', 'annual pay'], category: 'Salary' },
  { keywords: ['freelance', 'gig', 'side gig', 'consulting', 'contract', 'project', 'client payment', 'upwork', 'fiverr', 'freelancer', '99designs', 'toptal', 'guru', 'peopleperhour', 'consultant', 'consultancy', 'contractor', 'bounty', 'prize', 'award', 'competition', 'side hustle', 'side income', 'extra work', 'part time'], category: 'Freelance & Side Gigs' },
  { keywords: ['interest', 'dividend', 'capital gains', 'stock', 'mutual fund', 'bond', 'crypto', 'staking', 'dividends', 'stocks', 'shares', 'etf', 'investment', 'profit', 'returns', 'gains', 'earning', 'appreciation', 'payout', 'portfolio', 'trading', 'cryptocurrency', 'bitcoin', 'ethereum', 'forex', 'yield', 'interest income'], category: 'Investment Returns' },
  { keywords: ['business', 'sale', 'revenue', 'service', 'rental', 'rent received', 'royalty', 'affiliate', 'sponsorship', 'sales', 'invoice', 'billing', 'client payment', 'customer payment', 'order', 'commission', 'fee', 'charges', 'service fee', 'professional fee', 'merchant', 'sold', 'shop income', 'store', 'company', 'startup', 'enterprise', 'business income'], category: 'Business' },
  { keywords: ['refund', 'reimbursement', 'cashback', 'tax return', 'gst', 'claim', 'insurance payout', 'gift received', 'gift', 'cash back', 'reward', 'rewards', 'rebate', 'discount', 'voucher', 'coupon', 'credit', 'return', 'compensation', 'settlement', 'prize money', 'lottery', 'windfall', 'donation received'], category: 'Gift & Refund' },
  { keywords: ['bonus', 'award', 'inheritance', 'settlement', 'scholarship', 'pension', 'borrowed', 'loan received', 'rent', 'rental income', 'royalty', 'royalties', 'annuity', 'alimony', 'child support', 'grant', 'fellowship', 'subsidy', 'benefit', 'welfare', 'assistance', 'aid', 'other income', 'miscellaneous income', 'extra income', 'extra', 'additional income'], category: 'Other Income' },
];

const goalKeywords = [
  'goal', 'save for', 'saving for', 'savings goal', 'target for', 'towards my goal',
  'towards goal', 'goal contribution', 'contribute to goal', 'for my goal', 'save up for',
];
const groupKeywords = [
  'group expense', 'split', 'shared expense', 'split with', 'shared with', 'divide with',
  'group bill', 'split bill', 'split dinner', 'split lunch', 'shared bill', 'shared payment',
];
const investmentKeywords = [
  'invest', 'invested', 'bought stock', 'stock', 'stocks', 'sip', 'mutual fund', 'mutual funds',
  'etf', 'crypto', 'bitcoin', 'ethereum', 'gold', 'silver', 'bond', 'bonds', 'portfolio', 'share market',
];
const transferKeywords = ['transfer', 'moved', 'send', 'sent', 'to savings', 'to wallet', 'to bank', 'from savings', 'from bank', 'shifted', 'switch', 'swap', 'move money', 'fund transfer', 'between accounts', 'between account', 'moving', 'switch account', 'from account', 'to account'];
const incomeKeywords = ['salary', 'received', 'got', 'income', 'refund', 'reimbursement', 'cashback', 'gst', 'tax return', 'claim', 'bonus', 'interest', 'dividend', 'borrowed', 'credited', 'loan received', 'gift received', 'deposited', 'earned', 'commission', 'tip', 'received from', 'got paid', 'credited to', 'incoming', 'payment received', 'money received', 'credit', 'payout', 'awarded'];
const expenseKeywords = ['spent', 'spend', 'bought', 'buy', 'paid', 'pay', 'purchase', 'petrol', 'fuel', 'food', 'grocery', 'rent', 'movie', 'mobile', 'bill', 'charge', 'fee', 'ordered', 'purchased', 'subscription', 'membership', 'enrolled', 'registered', 'paid for', 'spent on', 'expense', 'cost', 'buying', 'shopping', 'payment', 'debited', 'debit', 'withdrew'];
const strongGoalPatterns = [
  /\b(?:save|saving|saved)\s+(?:for|towards)\b/i,
  /\bgoal contribution\b/i,
  /\bcontribut(?:e|ed)\b.*\bgoal\b/i,
  /\b(?:towards|for)\s+my\s+goal\b/i,
];
const strongGroupPatterns = [
  /\bsplit\b.*\bwith\b/i,
  /\bshared expense\b/i,
  /\bgroup expense\b/i,
  /\bshared bill\b/i,
];
const strongInvestmentPatterns = [
  /\binvest(?:ed|ing)?\b/i,
  /\bbought\s+(?:stock|stocks|shares?|crypto|bitcoin|ethereum|gold|bonds?)\b/i,
  /\b(?:sip|mutual fund|etf|portfolio)\b/i,
];
const strongTransferPatterns = [
  /\btransfer(?:red)?\b/i,
  /\bfund transfer\b/i,
  /\bbetween accounts?\b/i,
  /\bmoved?\b.*\b(?:to|from)\b/i,
  /\bsent\b.*\b(?:to|from)\b/i,
  /\b(?:to|from)\s+(?:savings|wallet|bank|account)\b/i,
];
const strongIncomePatterns = [
  /\b(?:salary|refund|reimbursement|cashback|bonus|interest|dividend|payout)\b/i,
  /\b(?:received|credited|earned|got paid|payment received|money received|received from|credited to)\b/i,
];
const strongExpensePatterns = [
  /\b(?:spent|paid|bought|purchased|ordered|debited|withdrew|payment|bill|rent|subscription|charge|fee)\b/i,
  /\b(?:paid for|paid to|spent on|bought from)\b/i,
  /\bpaid salary\b/i,
];

const numberWords: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const decimalWords: Record<string, number> = { half: 0.5, quarter: 0.25 };

const monthLookup: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sept: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const weekdayLookup: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const numericAmountPatterns = [
  /(?:rs|inr|rupees?|INR)\s*(\d[\d,]*(?:\.\d+)?)/gi,
  /(\d[\d,]*(?:\.\d+)?)\s*(?:rupees?|rs|inr)\b/gi,
  /\b(?:spent|spend|paid|pay|cost|price|amount|received|got|earned|credited|debited|transfer(?:red)?|sent|bought|buy|refund(?:ed)?|cashback|salary)\s+(?:for|of|inr|rs|rupees?)?\s*(\d[\d,]*(?:\.\d+)?)/gi,
];

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
  if (intent === 'transfer') return 'Transfer';
  if (intent === 'goal') return 'Goal Contribution';
  if (intent === 'group') return 'Group Expense';
  if (intent === 'investment') {
    const kind = inferInvestmentTypeFromText(lowerText);
    switch (kind) {
      case 'gold':
        return 'Gold Investment';
      case 'crypto':
        return 'Crypto Investment';
      case 'mutual-funds':
        return 'Mutual Fund Investment';
      case 'bonds':
        return 'Bond Investment';
      case 'stocks':
        return 'Stock Investment';
      default:
        return 'Investment';
    }
  }
  const rules = intent === 'income' ? incomeCategoryRules : expenseCategoryRules;
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => lowerText.includes(keyword))) return rule.category;
  }
  return null;
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

export function inferInvestmentTypeFromText(text: string): VoiceInvestmentKind {
  const lowerText = text.toLowerCase();

  if (/\b(gold|jewelry|jewellery|coin|bullion|sovereign|24k|22k)\b/i.test(lowerText)) {
    return 'gold';
  }
  if (/\b(bitcoin|ethereum|crypto|cryptocurrency|btc|eth|sol|usdt|doge)\b/i.test(lowerText)) {
    return 'crypto';
  }
  if (/\b(mutual fund|mutual funds|sip|etf|index fund|nifty)\b/i.test(lowerText)) {
    return 'mutual-funds';
  }
  if (/\b(bond|bonds|treasury|debenture|fixed income)\b/i.test(lowerText)) {
    return 'bonds';
  }
  if (/\b(stock|stocks|share|shares|equity|portfolio)\b/i.test(lowerText)) {
    return 'stocks';
  }

  return 'other';
}

export function extractGroupParticipantNames(text: string): string[] {
  const lowerText = text.toLowerCase();
  const match = lowerText.match(/\b(?:split with|shared with|divide with|with)\s+([^,.]+)/i);
  if (!match?.[1]) {
    return [];
  }

  const rawSegment = match[1]
    .replace(/\bfor\b.*$/i, '')
    .replace(/\b(?:yesterday|today|tomorrow|last\s+\w+)\b/gi, '')
    .trim();

  const disallowed = new Set([
    'me', 'myself', 'us', 'everyone', 'all', 'friends', 'team', 'group', 'roommates', 'family',
  ]);

  return rawSegment
    .split(/,|\band\b|&/i)
    .map((name) => name.trim())
    .filter((name) => name.length > 1)
    .filter((name) => !/^\d/.test(name))
    .map((name) => name.replace(/[^a-zA-Z\s'-]/g, '').trim())
    .filter((name) => name.length > 1 && !disallowed.has(name.toLowerCase()))
    .map((name) => name.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' '))
    .filter((name, index, items) => items.indexOf(name) === index)
    .slice(0, 8);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateFromParts(year: number, month: number, day: number): Date | null {
  const parsed = new Date(year, month, day);
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function resolveRelativeWeekday(targetWeekday: number, baseDate: Date, mode: 'last' | 'this'): Date {
  const cursor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const currentWeekday = cursor.getDay();
  let diff = currentWeekday - targetWeekday;

  if (mode === 'last') {
    diff = diff <= 0 ? diff + 7 : diff;
    cursor.setDate(cursor.getDate() - diff);
    return cursor;
  }

  diff = targetWeekday - currentWeekday;
  cursor.setDate(cursor.getDate() + diff);
  return cursor;
}

function extractDate(text: string, baseDate = new Date()): string | null {
  const lowerText = text.toLowerCase();
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  if (/\btoday\b/i.test(lowerText)) {
    return toDateKey(today);
  }
  if (/\byesterday\b/i.test(lowerText)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return toDateKey(yesterday);
  }
  if (/\btomorrow\b/i.test(lowerText)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return toDateKey(tomorrow);
  }

  const weekdayMatch = lowerText.match(/\b(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (weekdayMatch) {
    const [, mode, weekdayLabel] = weekdayMatch;
    const weekday = weekdayLookup[weekdayLabel.toLowerCase()];
    if (weekday !== undefined) {
      return toDateKey(resolveRelativeWeekday(weekday, today, mode.toLowerCase() as 'last' | 'this'));
    }
  }

  const isoMatch = lowerText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const parsed = buildDateFromParts(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return parsed ? toDateKey(parsed) : null;
  }

  const dayMonthMatch = lowerText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/i);
  if (dayMonthMatch) {
    const day = Number(dayMonthMatch[1]);
    const month = monthLookup[dayMonthMatch[2].toLowerCase()];
    const explicitYear = Number(dayMonthMatch[3] || today.getFullYear());
    let parsed = buildDateFromParts(explicitYear, month, day);
    if (!parsed) return null;
    if (!dayMonthMatch[3] && parsed.getTime() - today.getTime() > 7 * 24 * 60 * 60 * 1000) {
      parsed = buildDateFromParts(explicitYear - 1, month, day);
    }
    return parsed ? toDateKey(parsed) : null;
  }

  const monthDayMatch = lowerText.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
  if (monthDayMatch) {
    const month = monthLookup[monthDayMatch[1].toLowerCase()];
    const day = Number(monthDayMatch[2]);
    const explicitYear = Number(monthDayMatch[3] || today.getFullYear());
    let parsed = buildDateFromParts(explicitYear, month, day);
    if (!parsed) return null;
    if (!monthDayMatch[3] && parsed.getTime() - today.getTime() > 7 * 24 * 60 * 60 * 1000) {
      parsed = buildDateFromParts(explicitYear - 1, month, day);
    }
    return parsed ? toDateKey(parsed) : null;
  }

  return null;
}

function hasStrongPatternForIntent(text: string, intent: VoiceIntent): boolean {
  const patternMap: Record<VoiceIntent, RegExp[]> = {
    goal: strongGoalPatterns,
    group: strongGroupPatterns,
    investment: strongInvestmentPatterns,
    transfer: strongTransferPatterns,
    income: strongIncomePatterns,
    expense: strongExpensePatterns,
  };

  return patternMap[intent].some((pattern) => pattern.test(text));
}

function computeConfidence(text: string, intent: VoiceIntent, amount: number | null): number {
  let score = amount !== null ? 0.5 : 0.12;

  if (hasStrongPatternForIntent(text, intent)) {
    score += 0.3;
  }

  if (/\b(?:rs|inr|rupees?)\b/i.test(text)) {
    score += 0.15;
  }

  if (amount !== null && amount >= 10) {
    score += 0.05;
  }

  const keywordMap: Record<VoiceIntent, string[]> = {
    goal: goalKeywords,
    group: groupKeywords,
    investment: investmentKeywords,
    transfer: transferKeywords,
    income: incomeKeywords,
    expense: expenseKeywords,
  };
  const keywordMatches = countMatches(text.toLowerCase(), keywordMap[intent]);
  if (keywordMatches >= 2) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function detectIntent(text: string): VoiceIntent {
  const lowerText = text.toLowerCase();

  if (strongGoalPatterns.some((pattern) => pattern.test(lowerText)) || goalKeywords.some((keyword) => lowerText.includes(keyword))) {
    return 'goal';
  }

  if (strongGroupPatterns.some((pattern) => pattern.test(lowerText)) || groupKeywords.some((keyword) => lowerText.includes(keyword))) {
    return 'group';
  }

  if (strongInvestmentPatterns.some((pattern) => pattern.test(lowerText)) || investmentKeywords.some((keyword) => lowerText.includes(keyword))) {
    return 'investment';
  }

  if (strongTransferPatterns.some((pattern) => pattern.test(lowerText)) || transferKeywords.some((keyword) => lowerText.includes(keyword))) {
    return 'transfer';
  }
  
  let incomeScore = countMatches(lowerText, incomeKeywords);
  let expenseScore = countMatches(lowerText, expenseKeywords);

  if (strongIncomePatterns.some((pattern) => pattern.test(lowerText))) incomeScore += 2;
  if (strongExpensePatterns.some((pattern) => pattern.test(lowerText))) expenseScore += 2;

  if (/\bpaid salary\b/i.test(lowerText)) expenseScore += 3;
  if (/\b(?:salary|refund|reimbursement|cashback)\s+(?:received|credited)\b/i.test(lowerText)) incomeScore += 3;
  if (/\b(?:received from|payment received|money received|credited to)\b/i.test(lowerText)) incomeScore += 2;
  if (/\b(?:paid to|paid for|spent on|bought from)\b/i.test(lowerText)) expenseScore += 2;
  
  if (incomeScore > expenseScore) return 'income';
  if (expenseScore > incomeScore) return 'expense';

  // Fallback to category detection
  if (detectCategory(lowerText, 'income')) return 'income';
  if (detectCategory(lowerText, 'expense')) return 'expense';

  return 'expense'; // Default fallback
}

function extractNumericAmount(text: string): { amount: number | null; matchedText: string | null } {
  const candidates: Array<{ amount: number; matchedText: string; score: number }> = [];

  for (const pattern of numericAmountPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const amount = Number(match[1]?.replace(/,/g, ''));
      if (!Number.isFinite(amount)) continue;
      candidates.push({
        amount,
        matchedText: match[0],
        score: 3 + Math.min(1, amount / 100000),
      });
    }
  }

  for (const match of text.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g)) {
    const rawValue = match[0];
    const amount = Number(rawValue.replace(/,/g, ''));
    if (!Number.isFinite(amount)) continue;

    const start = match.index ?? 0;
    const end = start + rawValue.length;
    const before = text[start - 1] ?? '';
    const after = text[end] ?? '';
    if (before === '/' || before === '-' || after === '/' || after === '-') continue;

    const context = text.slice(Math.max(0, start - 18), Math.min(text.length, end + 18)).toLowerCase();
    let score = amount >= 100 ? 1.4 : 1;
    if (/(rs|inr|INR|rupees?|spent|paid|received|credited|debited|salary|refund|cashback|transfer|bought|cost)/i.test(context)) {
      score += 1.3;
    }
    if (amount >= 1900 && amount <= 2100 && /\b\d{4}\b/.test(rawValue)) score -= 1.5;

    candidates.push({
      amount,
      matchedText: rawValue,
      score,
    });
  }

  if (candidates.length === 0) return { amount: null, matchedText: null };

  const bestCandidate = candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.amount - left.amount;
  })[0];

  return bestCandidate
    ? { amount: bestCandidate.amount, matchedText: bestCandidate.matchedText }
    : { amount: null, matchedText: null };
}

function extractAmountFromChunk(chunk: string): { amount: number | null; description: string } {
  const text = chunk.trim();
  const numericMatch = extractNumericAmount(text);
  let amount: number | null = numericMatch.amount;
  let description = text;

  if (numericMatch.matchedText) {
    description = text.replace(numericMatch.matchedText, '').trim();
  }

  if (!amount) {
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

  return {
    amount,
    description: description.replace(/^(?:for|on|at|to|from|of|towards)\s+/i, '').trim(),
  };
}

function splitTransactionChunks(rawText: string): string[] {
  const fragments = rawText
    .toLowerCase()
    .trim()
    .split(/\b(?:and|also|plus|then|next)\b|,|;|\n|\r\n|\.(?!\d)/i)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 2);

  const chunks: string[] = [];
  let pending = '';

  for (const fragment of fragments) {
    const combined = pending ? `${pending} ${fragment}`.trim() : fragment;
    const { amount } = extractAmountFromChunk(combined);
    if (amount !== null) {
      chunks.push(combined);
      pending = '';
      continue;
    }

    pending = combined;
  }

  if (pending) {
    chunks.push(pending);
  }

  return chunks;
}

export function parseMultipleTransactions(rawText: string): VoiceParseResult[] {
  const results: VoiceParseResult[] = [];

  for (const chunk of splitTransactionChunks(rawText)) {
    const { amount, description } = extractAmountFromChunk(chunk);
    if (amount === null) continue;

    const intent = detectIntent(chunk);
    const category = detectCategory(chunk, intent);
    const date = extractDate(chunk);
    const confidence = computeConfidence(chunk, intent, amount);

    results.push({
      intent,
      amount,
      category,
      description: description || chunk,
      confidence,
      date,
    });
  }

  return results;
}

export function parseMultipleExpenses(rawText: string): Array<Omit<VoiceParseResult, 'intent'> & { intent: 'expense' }> {
  return parseMultipleTransactions(rawText)
    .filter((item) => item.intent === 'expense')
    .map((item) => ({ ...item, intent: 'expense' as const }));
}

export function parseVoiceExpense(rawText: string): VoiceParseResult {
  const text = rawText.toLowerCase().trim();
  const intent: VoiceIntent = detectIntent(text);
  let amount = extractNumericAmount(text).amount;

  if (!amount) {
    amount = wordsToNumber(text);
  }

  const category = detectCategory(text, intent);
  const confidence = computeConfidence(text, intent, amount);
  const date = extractDate(text);
  return { intent, amount, category, description: rawText.trim(), confidence, date };
}
