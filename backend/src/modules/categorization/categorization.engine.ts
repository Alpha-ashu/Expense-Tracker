import { prisma } from '../../db/prisma';

export interface CategorizationResult {
  category: string;
  subcategory: string;
  confidence: number;
  matchedBy: 'learned' | 'exact' | 'partial' | 'token' | 'fuzzy' | 'fallback';
}

const KEYWORDS: Array<{ keyword: string; category: string; subcategory: string; weight?: number }> = [
  { keyword: 'pani puri', category: 'Food & Dining', subcategory: 'Street Food', weight: 2 },
  { keyword: 'golgappa', category: 'Food & Dining', subcategory: 'Street Food', weight: 2 },
  { keyword: 'chaat', category: 'Food & Dining', subcategory: 'Street Food' },
  { keyword: 'samosa', category: 'Food & Dining', subcategory: 'Street Food' },
  { keyword: 'snack', category: 'Food & Dining', subcategory: 'Snacks' },
  { keyword: 'chips', category: 'Food & Dining', subcategory: 'Snacks' },
  { keyword: 'tea', category: 'Food & Dining', subcategory: 'Coffee' },
  { keyword: 'chai', category: 'Food & Dining', subcategory: 'Coffee' },
  { keyword: 'coffee', category: 'Food & Dining', subcategory: 'Coffee' },
  { keyword: 'restaurant', category: 'Food & Dining', subcategory: 'Restaurant' },
  { keyword: 'zomato', category: 'Food & Dining', subcategory: 'Food Delivery' },
  { keyword: 'swiggy', category: 'Food & Dining', subcategory: 'Food Delivery' },
  { keyword: 'petrol', category: 'Transportation', subcategory: 'Petrol', weight: 2 },
  { keyword: 'diesel', category: 'Transportation', subcategory: 'Diesel', weight: 2 },
  { keyword: 'fuel', category: 'Transportation', subcategory: 'Petrol', weight: 2 },
  { keyword: 'uber', category: 'Transportation', subcategory: 'Taxi' },
  { keyword: 'ola', category: 'Transportation', subcategory: 'Taxi' },
  { keyword: 'rapido', category: 'Transportation', subcategory: 'Taxi' },
  { keyword: 'metro', category: 'Transportation', subcategory: 'Metro Ticket' },
  { keyword: 'bus', category: 'Transportation', subcategory: 'Bus Ticket' },
  { keyword: 'toll', category: 'Transportation', subcategory: 'Toll Fees' },
  { keyword: 'headlight', category: 'Vehicle', subcategory: 'Car Service', weight: 2 },
  { keyword: 'repair', category: 'Vehicle', subcategory: 'Car Service' },
  { keyword: 'maintenance', category: 'Vehicle', subcategory: 'Car Service' },
  { keyword: 'tyre', category: 'Vehicle', subcategory: 'Tires' },
  { keyword: 'tire', category: 'Vehicle', subcategory: 'Tires' },
  { keyword: 'electricity', category: 'Utilities', subcategory: 'Electricity Bill' },
  { keyword: 'wifi', category: 'Utilities', subcategory: 'Internet Bill' },
  { keyword: 'internet', category: 'Utilities', subcategory: 'Internet Bill' },
  { keyword: 'mobile recharge', category: 'Utilities', subcategory: 'Mobile Recharge' },
  { keyword: 'amazon', category: 'Shopping', subcategory: 'Online Shopping' },
  { keyword: 'flipkart', category: 'Shopping', subcategory: 'Online Shopping' },
  { keyword: 'medicine', category: 'Health & Medical', subcategory: 'Medicines' },
  { keyword: 'pharmacy', category: 'Health & Medical', subcategory: 'Medicines' },
  { keyword: 'doctor', category: 'Health & Medical', subcategory: 'Doctor Visit' },
  { keyword: 'netflix', category: 'Subscriptions', subcategory: 'Streaming Services' },
  { keyword: 'spotify', category: 'Subscriptions', subcategory: 'Music Subscription' },
  { keyword: 'emi', category: 'Loan / Debt Payments', subcategory: 'EMI Payment' },
  { keyword: 'loan payment', category: 'Loan / Debt Payments', subcategory: 'Loan Payment' },
  { keyword: 'stock', category: 'Investments', subcategory: 'Stocks Purchase' },
  { keyword: 'mutual fund', category: 'Investments', subcategory: 'Mutual Funds' },
];

const SYNONYMS: Record<string, string[]> = {
  fuel: ['petrol', 'diesel', 'gas'],
  petrol: ['fuel'],
  repair: ['maintenance', 'service', 'fix'],
  car: ['vehicle'],
  bike: ['vehicle', 'two wheeler'],
  food: ['meal', 'dining', 'restaurant'],
  bill: ['payment', 'charge'],
};

let ready = false;

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalizeText(value).split(' ').filter(Boolean);

const expandTokens = (tokens: string[]) => {
  const expanded = new Set(tokens);
  tokens.forEach((token) => SYNONYMS[token]?.forEach((synonym) => expanded.add(synonym)));
  return Array.from(expanded);
};

const levenshtein = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  if (left.length > 24 || right.length > 24) return Math.abs(left.length - right.length) + 4;

  const matrix = Array.from({ length: right.length + 1 }, (_, row) =>
    Array.from({ length: left.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0)),
  );

  for (let row = 1; row <= right.length; row += 1) {
    for (let col = 1; col <= left.length; col += 1) {
      matrix[row][col] = right[row - 1] === left[col - 1]
        ? matrix[row - 1][col - 1]
        : 1 + Math.min(matrix[row - 1][col], matrix[row][col - 1], matrix[row - 1][col - 1]);
    }
  }

  return matrix[right.length][left.length];
};

export const ensureCategorizationTables = async () => {
  if (ready) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS keyword_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      keyword TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      confidence_score NUMERIC DEFAULT 0.8,
      usage_count INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_learning (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      input_text TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      usage_count INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, input_text)
    );
  `);

  for (const entry of KEYWORDS) {
    await prisma.$executeRaw`
      INSERT INTO keyword_mappings (keyword, category, subcategory, confidence_score, usage_count)
      VALUES (${entry.keyword}, ${entry.category}, ${entry.subcategory}, ${0.82 * (entry.weight ?? 1)}, 1)
      ON CONFLICT (keyword) DO NOTHING
    `;
  }

  ready = true;
};

export const categorizeTextForUser = async (userId: string, text: string): Promise<CategorizationResult> => {
  const normalized = normalizeText(text);

  if (!normalized) {
    return { category: 'Miscellaneous', subcategory: 'Other', confidence: 0, matchedBy: 'fallback' };
  }

  await ensureCategorizationTables();

  const learned = await prisma.$queryRaw<Array<{ category: string; subcategory: string | null }>>`
    SELECT category, subcategory
    FROM user_learning
    WHERE user_id = ${userId} AND input_text = ${normalized}
    LIMIT 1
  `;

  if (learned[0]) {
    return {
      category: learned[0].category,
      subcategory: learned[0].subcategory || 'Other',
      confidence: 0.98,
      matchedBy: 'learned',
    };
  }

  const exact = await prisma.$queryRaw<Array<{ category: string; subcategory: string | null; confidence_score: number }>>`
    SELECT category, subcategory, confidence_score
    FROM keyword_mappings
    WHERE keyword = ${normalized}
    LIMIT 1
  `;

  if (exact[0]) {
    return {
      category: exact[0].category,
      subcategory: exact[0].subcategory || 'Other',
      confidence: 0.95,
      matchedBy: 'exact',
    };
  }

  const partial = await prisma.$queryRaw<Array<{ category: string; subcategory: string | null; confidence_score: number }>>`
    SELECT category, subcategory, confidence_score
    FROM keyword_mappings
    WHERE ${normalized} ILIKE '%' || keyword || '%'
    ORDER BY usage_count DESC, LENGTH(keyword) DESC
    LIMIT 1
  `;

  if (partial[0]) {
    return {
      category: partial[0].category,
      subcategory: partial[0].subcategory || 'Other',
      confidence: 0.86,
      matchedBy: 'partial',
    };
  }

  const rows = await prisma.$queryRaw<Array<{ keyword: string; category: string; subcategory: string | null; usage_count: number }>>`
    SELECT keyword, category, subcategory, usage_count
    FROM keyword_mappings
  `;

  const tokens = expandTokens(tokenize(normalized));
  let best: { row: (typeof rows)[number]; score: number; matchedBy: CategorizationResult['matchedBy'] } | null = null;

  for (const row of rows) {
    const keyword = normalizeText(row.keyword);
    const keywordTokens = tokenize(keyword);
    const tokenMatches = keywordTokens.filter((keywordToken) =>
      tokens.some((token) => token === keywordToken || token.startsWith(keywordToken) || keywordToken.startsWith(token)),
    ).length;

    if (tokenMatches > 0) {
      const score = tokenMatches / Math.max(keywordTokens.length, 1) + Math.min(row.usage_count / 100, 0.2);
      if (!best || score > best.score) {
        best = { row, score, matchedBy: 'token' };
      }
    }

    for (const token of tokens) {
      for (const keywordToken of keywordTokens) {
        if (token.length < 4 || keywordToken.length < 4) continue;
        const distance = levenshtein(token, keywordToken);
        if (distance <= 2) {
          const score = 0.5 + ((2 - distance) * 0.08) + Math.min(row.usage_count / 120, 0.16);
          if (!best || score > best.score) {
            best = { row, score, matchedBy: 'fuzzy' };
          }
        }
      }
    }
  }

  if (best && best.score >= 0.5) {
    return {
      category: best.row.category,
      subcategory: best.row.subcategory || 'Other',
      confidence: Math.min(best.score, best.matchedBy === 'token' ? 0.82 : 0.68),
      matchedBy: best.matchedBy,
    };
  }

  return { category: 'Miscellaneous', subcategory: 'Other', confidence: 0.1, matchedBy: 'fallback' };
};

export const learnCategorizationForUser = async (
  userId: string,
  text: string,
  category: string,
  subcategory = '',
) => {
  const normalized = normalizeText(text);
  const normalizedCategory = category.trim();
  const normalizedSubcategory = subcategory.trim() || 'Other';

  if (!normalized || !normalizedCategory) return;

  await ensureCategorizationTables();

  await prisma.$executeRaw`
    INSERT INTO user_learning (user_id, input_text, category, subcategory, usage_count, updated_at)
    VALUES (${userId}, ${normalized}, ${normalizedCategory}, ${normalizedSubcategory}, 1, ${new Date()})
    ON CONFLICT (user_id, input_text)
    DO UPDATE SET
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      usage_count = user_learning.usage_count + 1,
      updated_at = EXCLUDED.updated_at
  `;

  await prisma.$executeRaw`
    INSERT INTO keyword_mappings (keyword, category, subcategory, confidence_score, usage_count, updated_at)
    VALUES (${normalized}, ${normalizedCategory}, ${normalizedSubcategory}, 0.92, 1, ${new Date()})
    ON CONFLICT (keyword)
    DO UPDATE SET
      category = EXCLUDED.category,
      subcategory = EXCLUDED.subcategory,
      confidence_score = GREATEST(keyword_mappings.confidence_score, 0.92),
      usage_count = keyword_mappings.usage_count + 1,
      updated_at = EXCLUDED.updated_at
  `;
};
