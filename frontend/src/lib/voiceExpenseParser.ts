export type VoiceIntent = 'expense' | 'income' | 'transfer';

export interface VoiceParseResult {
  intent: VoiceIntent;
  amount: number | null;
  category: string | null;
  description: string;
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

const transferKeywords = ['transfer', 'moved', 'send', 'sent', 'to savings', 'to wallet', 'to bank', 'from savings', 'from bank', 'shifted', 'switch', 'swap', 'move money', 'fund transfer', 'between accounts', 'between account', 'moving', 'switch account', 'from account', 'to account'];
const incomeKeywords = ['salary', 'received', 'got', 'income', 'refund', 'reimbursement', 'cashback', 'gst', 'tax return', 'claim', 'bonus', 'interest', 'dividend', 'borrowed', 'credited', 'loan received', 'gift received', 'paid', 'deposited', 'earned', 'commission', 'tip', 'received from', 'got paid', 'credited to', 'incoming', 'payment received', 'money received', 'credit', 'payout', 'given', 'awarded'];
const expenseKeywords = ['spent', 'spend', 'bought', 'buy', 'paid', 'pay', 'purchase', 'petrol', 'fuel', 'food', 'grocery', 'rent', 'movie', 'mobile', 'bill', 'charge', 'fee', 'ordered', 'purchased', 'subscription', 'membership', 'enrolled', 'registered', 'paid for', 'spent on', 'expense', 'cost', 'buying', 'shopping', 'payment', 'debited', 'debit', 'withdrew'];

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
