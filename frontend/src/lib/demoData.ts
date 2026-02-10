import { db } from './database';

export const initializeDemoData = async (userEmail?: string) => {
  const targetAdminEmail = 'shaik.job.details@gmail.com';
  const isAdmin = userEmail?.toLowerCase() === targetAdminEmail;
  const hasSeededAdmin = localStorage.getItem('admin_data_seeded_v2') === 'true';

  if (isAdmin && !hasSeededAdmin) {
    console.log('Forcing demo data reset for Admin:', userEmail);
    // Clear existing data for a fresh start
    await Promise.all([
      db.accounts.clear(),
      db.transactions.clear(),
      db.loans.clear(),
      db.goals.clear(),
      db.investments.clear(),
      db.notifications.clear()
    ]);
  } else {
    // Normal behavior: Skip if data exists
    const existingAccounts = await db.accounts.count();
    if (existingAccounts > 0) {
      return;
    }
  }

  // Add demo accounts
  const accountIds = await db.accounts.bulkAdd([
    {
      name: 'Chase Checking',
      type: 'bank',
      balance: 12450.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      name: 'Amex Platinum',
      type: 'card',
      balance: 450.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      name: 'Apple Cash',
      type: 'wallet',
      balance: 850.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
    {
      name: 'Physical Wallet',
      type: 'cash',
      balance: 120.00,
      currency: 'USD',
      isActive: true,
      createdAt: new Date('2024-01-01'),
    },
  ]);

  // Add demo transactions
  await db.transactions.bulkAdd([
    {
      type: 'income',
      amount: 8500,
      accountId: 1, // Will map to first generated ID if auto-increment is reset, but safest to assume sequential providing we just cleared
      category: 'Salary',
      description: 'Monthly Salary - Google',
      date: new Date('2026-02-01'),
      tags: ['salary', 'work'],
    },
    {
      type: 'income',
      amount: 1200,
      accountId: 1,
      category: 'Freelance',
      description: 'Consulting Project',
      date: new Date('2026-02-03'),
      tags: ['side-hustle'],
    },
    {
      type: 'expense',
      amount: 2400,
      accountId: 1,
      category: 'Housing',
      description: 'Luxury Apartment Rent',
      date: new Date('2026-02-02'),
      tags: ['rent', 'fixed'],
    },
    {
      type: 'expense',
      amount: 185.50,
      accountId: 2,
      category: 'Food & Dining',
      description: 'Dinner at Nobu',
      merchant: 'Nobu',
      date: new Date('2026-02-04'),
      tags: ['dining', 'date-night'],
    },
    {
      type: 'expense',
      amount: 45.00,
      accountId: 3,
      category: 'Transportation',
      description: 'Uber Ride',
      merchant: 'Uber',
      date: new Date('2026-02-05'),
      tags: ['transport'],
    },
    {
      type: 'expense',
      amount: 14.99,
      accountId: 2,
      category: 'Entertainment',
      description: 'Netflix Premium',
      merchant: 'Netflix',
      date: new Date('2026-02-01'),
      tags: ['subscription'],
    },
    {
      type: 'expense',
      amount: 120.00,
      accountId: 4,
      category: 'Personal Care',
      description: 'Haircut & Spa',
      date: new Date('2026-02-06'),
      tags: ['self-care'],
    },
  ]);

  // Add demo loan
  await db.loans.add({
    type: 'emi',
    name: 'Tesla Model S Loan',
    principalAmount: 85000,
    outstandingBalance: 62000,
    interestRate: 3.5,
    emiAmount: 1100,
    dueDate: new Date('2026-02-15'),
    frequency: 'monthly',
    status: 'active',
    createdAt: new Date('2024-06-01'),
  });

  // Add demo goal
  await db.goals.add({
    name: 'Europe Summer Trip',
    targetAmount: 15000,
    currentAmount: 6500,
    targetDate: new Date('2026-06-01'),
    category: 'Travel',
    isGroupGoal: false,
    createdAt: new Date('2026-01-01'),
  });

  // Add demo investment
  await db.investments.add({
    assetType: 'stock',
    assetName: 'Tesla Inc. (TSLA)',
    quantity: 50,
    buyPrice: 180.00,
    currentPrice: 240.00,
    totalInvested: 9000,
    currentValue: 12000,
    profitLoss: 3000,
    purchaseDate: new Date('2025-01-15'),
    lastUpdated: new Date(),
  });

  if (isAdmin) {
    localStorage.setItem('admin_data_seeded_v2', 'true');
    console.log('Admin data seeded successfully');
  } else {
    console.log('Demo data initialized (Standard)');
  }
};
