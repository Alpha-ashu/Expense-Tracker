import { db } from './database';

export const initializeDemoData = async () => {
  // Check if data already exists
  const existingAccounts = await db.accounts.count();
  if (existingAccounts > 0) {
    return; // Already has data
  }

  // Add demo accounts
  const accountIds = await db.accounts.bulkAdd([
    {
      name: 'Chase Checking',
      type: 'bank',
      balance: 5420.50,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      name: 'Amex Credit Card',
      type: 'card',
      balance: 2100.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      name: 'Cash Wallet',
      type: 'cash',
      balance: 350.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
  ]);

  // Add demo transactions
  await db.transactions.bulkAdd([
    {
      type: 'income',
      amount: 5500,
      accountId: 1,
      category: 'Salary',
      description: 'Monthly Salary',
      date: new Date('2026-01-01'),
      tags: [],
    },
    {
      type: 'expense',
      amount: 1200,
      accountId: 1,
      category: 'Bills & Utilities',
      description: 'Rent Payment',
      date: new Date('2026-01-05'),
      tags: [],
    },
    {
      type: 'expense',
      amount: 85.50,
      accountId: 2,
      category: 'Food & Dining',
      description: 'Grocery Shopping',
      merchant: 'Whole Foods',
      date: new Date('2026-01-15'),
      tags: [],
    },
    {
      type: 'expense',
      amount: 45.00,
      accountId: 3,
      category: 'Transportation',
      description: 'Gas',
      merchant: 'Shell',
      date: new Date('2026-01-20'),
      tags: [],
    },
  ]);

  // Add demo loan
  await db.loans.add({
    type: 'emi',
    name: 'Car Loan',
    principalAmount: 25000,
    outstandingBalance: 18500,
    interestRate: 5.5,
    emiAmount: 450,
    dueDate: new Date('2026-02-05'),
    frequency: 'monthly',
    status: 'active',
    createdAt: new Date('2024-06-01'),
  });

  // Add demo goal
  await db.goals.add({
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 3500,
    targetDate: new Date('2026-12-31'),
    category: 'Savings',
    isGroupGoal: false,
    createdAt: new Date('2026-01-01'),
  });

  // Add demo investment
  await db.investments.add({
    assetType: 'stock',
    assetName: 'Apple Inc. (AAPL)',
    quantity: 10,
    buyPrice: 150.00,
    currentPrice: 175.00,
    totalInvested: 1500,
    currentValue: 1750,
    profitLoss: 250,
    purchaseDate: new Date('2025-10-01'),
    lastUpdated: new Date(),
  });

  console.log('Demo data initialized');
};
