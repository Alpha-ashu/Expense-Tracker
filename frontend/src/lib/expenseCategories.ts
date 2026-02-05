// Expense Categories with Subcategories
export const EXPENSE_CATEGORIES = {
  entertainment: {
    name: 'Entertainment',
    icon: '🎬',
    color: '#8B5CF6',
    subcategories: ['Movie', 'Music', 'Restaurant', 'Bar', 'Events', 'Gaming', 'Streaming Services', 'Concert']
  },
  food: {
    name: 'Food & Dining',
    icon: '🍔',
    color: '#EF4444',
    subcategories: ['Groceries', 'Restaurant', 'Cafe', 'Delivery', 'Fast Food', 'Lunch', 'Breakfast', 'Dinner']
  },
  transportation: {
    name: 'Transportation',
    icon: '🚗',
    color: '#F97316',
    subcategories: ['Fuel', 'Parking', 'Taxi', 'Public Transport', 'Uber/Lyft', 'Bike', 'Train', 'Flight']
  },
  utilities: {
    name: 'Utilities',
    icon: '💡',
    color: '#EAB308',
    subcategories: ['Electricity', 'Water', 'Gas', 'Internet', 'Phone', 'Insurance', 'Rent', 'Maintenance']
  },
  healthcare: {
    name: 'Healthcare',
    icon: '⚕️',
    color: '#06B6D4',
    subcategories: ['Doctor', 'Medicine', 'Pharmacy', 'Hospital', 'Dental', 'Optical', 'Therapy', 'Vaccination']
  },
  shopping: {
    name: 'Shopping',
    icon: '🛍️',
    color: '#EC4899',
    subcategories: ['Clothing', 'Electronics', 'Home', 'Beauty', 'Books', 'Sports', 'Accessories', 'Furniture']
  },
  education: {
    name: 'Education',
    icon: '📚',
    color: '#3B82F6',
    subcategories: ['Tuition', 'Books', 'Courses', 'Training', 'Exam Fees', 'School Supplies', 'Workshop', 'Certification']
  },
  fitness: {
    name: 'Fitness & Sports',
    icon: '🏋️',
    color: '#10B981',
    subcategories: ['Gym Membership', 'Sports Equipment', 'Classes', 'Nutrition', 'Yoga', 'Swimming', 'Tennis', 'Running']
  },
  travel: {
    name: 'Travel',
    icon: '✈️',
    color: '#6366F1',
    subcategories: ['Flight', 'Hotel', 'Accommodation', 'Activities', 'Tours', 'Visa', 'Travel Insurance', 'Luggage']
  },
  personal: {
    name: 'Personal Care',
    icon: '💅',
    color: '#F43F5E',
    subcategories: ['Haircut', 'Salon', 'Spa', 'Cosmetics', 'Perfume', 'Grooming', 'Massage', 'Skincare']
  },
  pets: {
    name: 'Pets',
    icon: '🐾',
    color: '#F59E0B',
    subcategories: ['Food', 'Veterinary', 'Grooming', 'Toys', 'Accessories', 'Training', 'Insurance', 'Medication']
  },
  gifts: {
    name: 'Gifts & Donations',
    icon: '🎁',
    color: '#A855F7',
    subcategories: ['Birthday', 'Wedding', 'Anniversary', 'Charity', 'Religious', 'Charity Donation', 'Holiday Gift', 'Flowers']
  },
  finance: {
    name: 'Financial',
    icon: '💳',
    color: '#0EA5E9',
    subcategories: ['Bank Charges', 'Interest', 'Investment Fees', 'Tax', 'Insurance', 'Loan Payment', 'Credit Card Fee', 'Transfer Fee']
  },
  work: {
    name: 'Work & Business',
    icon: '💼',
    color: '#06B6D4',
    subcategories: ['Office Supplies', 'Tools', 'Software', 'Meetings', 'Client Meals', 'Conference', 'Equipment', 'Parking']
  },
  miscellaneous: {
    name: 'Miscellaneous',
    icon: '📌',
    color: '#64748B',
    subcategories: ['Other', 'Uncategorized', 'Hobby', 'Cleaning', 'Repairs', 'Laundry', 'Storage', 'Services']
  }
};

export const INCOME_CATEGORIES = {
  salary: {
    name: 'Salary',
    icon: '💰',
    color: '#10B981',
    subcategories: ['Monthly Salary', 'Bonus', 'Overtime', 'Allowance', 'Advance', 'Backpay', 'Raise', 'Commission']
  },
  freelance: {
    name: 'Freelance & Side Gigs',
    icon: '💻',
    color: '#3B82F6',
    subcategories: ['Freelance Project', 'Consulting', 'Tutoring', 'Writing', 'Design', 'Photography', 'Transcription', 'Virtual Assistant']
  },
  investment: {
    name: 'Investment Returns',
    icon: '📈',
    color: '#F59E0B',
    subcategories: ['Dividends', 'Interest', 'Capital Gains', 'Crypto Returns', 'Stock Sale', 'Mutual Funds', 'Bonds', 'Real Estate']
  },
  business: {
    name: 'Business',
    icon: '🏢',
    color: '#8B5CF6',
    subcategories: ['Sales', 'Service Revenue', 'Rental Income', 'Product Sale', 'Affiliate Commission', 'Sponsorship', 'License Fee', 'Royalty']
  },
  gift: {
    name: 'Gift & Refund',
    icon: '🎁',
    color: '#EC4899',
    subcategories: ['Gift Received', 'Refund', 'Reimbursement', 'Insurance Payout', 'Lottery', 'Found Money', 'Tax Return', 'Subsidy']
  },
  other: {
    name: 'Other Income',
    icon: '💵',
    color: '#64748B',
    subcategories: ['Bonus', 'Award', 'Inheritance', 'Settlement', 'Residual Income', 'Stipend', 'Scholarship', 'Pension']
  }
};

// Tax Brackets (India as example - customize as needed)
export const TAX_BRACKETS = {
  india: {
    singleFiler: [
      { min: 0, max: 250000, rate: 0 },
      { min: 250001, max: 500000, rate: 5 },
      { min: 500001, max: 1000000, rate: 20 },
      { min: 1000001, max: Infinity, rate: 30 }
    ],
    marriedFiler: [
      { min: 0, max: 500000, rate: 0 },
      { min: 500001, max: 1000000, rate: 5 },
      { min: 1000001, max: 1500000, rate: 20 },
      { min: 1500001, max: Infinity, rate: 30 }
    ]
  },
  usa: {
    singleFiler: [
      { min: 0, max: 11000, rate: 0.10 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182100, rate: 0.24 },
      { min: 182100, max: 231250, rate: 0.32 },
      { min: 231250, max: 578125, rate: 0.35 },
      { min: 578125, max: Infinity, rate: 0.37 }
    ],
    marriedFiler: [
      { min: 0, max: 22000, rate: 0.10 },
      { min: 22000, max: 89075, rate: 0.12 },
      { min: 89075, max: 190750, rate: 0.22 },
      { min: 190750, max: 364200, rate: 0.24 },
      { min: 364200, max: 462500, rate: 0.32 },
      { min: 462500, max: 693750, rate: 0.35 },
      { min: 693750, max: Infinity, rate: 0.37 }
    ]
  }
};

export const STANDARD_DEDUCTIONS = {
  india: {
    singleFiler: 50000,
    marriedFiler: 50000,
    seniorCitizen: 100000
  },
  usa: {
    singleFiler: 13850,
    marriedFiler: 27700,
    headOfHousehold: 20800,
    seniorCitizen: 16550
  }
};

// Calculate tax based on income
export function calculateTax(income: number, country: string = 'india', filingStatus: string = 'singleFiler'): {
  taxableIncome: number;
  tax: number;
  effectiveRate: number;
} {
  const brackets = TAX_BRACKETS[country as keyof typeof TAX_BRACKETS];
  const deduction = STANDARD_DEDUCTIONS[country as keyof typeof STANDARD_DEDUCTIONS][filingStatus as keyof typeof STANDARD_DEDUCTIONS.india];

  if (!brackets || !deduction) {
    return { taxableIncome: 0, tax: 0, effectiveRate: 0 };
  }

  const taxableIncome = Math.max(0, income - deduction);
  let tax = 0;

  const bracketsArray = Array.isArray(brackets) ? brackets : Object.values(brackets);
  for (const bracket of bracketsArray) {
    if (taxableIncome > bracket.min) {
      const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      tax += incomeInBracket * bracket.rate;
    }
  }

  const effectiveRate = income > 0 ? (tax / income) * 100 : 0;

  return {
    taxableIncome,
    tax,
    effectiveRate
  };
}

// Get all subcategories for a category
export function getSubcategoriesForCategory(category: string, type: 'expense' | 'income' = 'expense'): string[] {
  const categoryData = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const categoryKey = category.toLowerCase().replace(/\s+/g, '');

  for (const [key, value] of Object.entries(categoryData)) {
    if (key === categoryKey || value.name.toLowerCase() === category.toLowerCase()) {
      return value.subcategories;
    }
  }

  return [];
}

// Get category details
export function getCategoryDetails(category: string, type: 'expense' | 'income' = 'expense') {
  const categoryData = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const categoryKey = category.toLowerCase().replace(/\s+/g, '');

  for (const [key, value] of Object.entries(categoryData)) {
    if (key === categoryKey || value.name.toLowerCase() === category.toLowerCase()) {
      return value;
    }
  }

  return null;
}
