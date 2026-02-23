import { db } from './database';

export const initializeDemoData = async (userEmail?: string, userId?: string) => {
  const targetAdminEmail = 'shaik.job.details@gmail.com';
  const isAdmin = userEmail?.toLowerCase() === targetAdminEmail;
  const hasSeededAdmin = localStorage.getItem('admin_data_seeded_v2') === 'true';

  // Only admin gets demo data - new users start with blank data
  if (!isAdmin) {
    console.log('Non-admin user - skipping demo data seeding');
    // Seed empty todo lists for non-admin users with their real userId
    await seedToDoListsIfNeeded(userId ?? 'user');
    return;
  }

  if (isAdmin && !hasSeededAdmin) {
    console.log('Forcing demo data reset for Admin:', userEmail);
    // Clear existing data for a fresh start
    await Promise.all([
      db.accounts.clear(),
      db.transactions.clear(),
      db.loans.clear(),
      db.goals.clear(),
      db.investments.clear(),
      db.notifications.clear(),
      db.toDoLists.clear(),
      db.toDoItems.clear(),
    ]);
  } else {
    // Admin with existing data: Skip if data exists
    const existingAccounts = await db.accounts.count();
    if (existingAccounts > 0) {
      // Still seed todo lists if they don't exist
      await seedToDoListsIfNeeded();
      return;
    }
  }

  // Add demo accounts
  await db.accounts.bulkAdd([
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

  // Add demo finance advisors
  await db.financeAdvisors.bulkAdd([
    {
      userId: 'advisor-1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@financelife.com',
      phone: '+1-555-0123',
      photo: '/api/placeholder/150/150',
      bio: 'Specialized in helping clients build long-term wealth through strategic investment planning and tax optimization. Focus on retirement planning and wealth preservation strategies.',
      specialization: ['Investment Planning', 'Retirement Planning', 'Tax Optimization'],
      experience: 15,
      qualifications: ['MBA in Finance', 'CFP®', 'Series 7', 'Series 66'],
      rating: 4.8,
      totalReviews: 127,
      clientsCompleted: 892,
      activeClients: 45,
      verified: true,
      socialLinks: {
        linkedin: 'https://linkedin.com/in/sarahjohnson-cfp',
        twitter: 'https://twitter.com/sarahjohnson'
      },
      availability: true,
      hourlyRate: 150,
      createdAt: new Date('2023-01-15')
    },
    {
      userId: 'advisor-2',
      name: 'Michael Chen',
      email: 'michael.chen@financelife.com',
      phone: '+1-555-0124',
      photo: '/api/placeholder/150/150',
      bio: 'Expert in complex tax planning, estate structuring, and business tax strategies. Help high-net-worth individuals minimize tax burden while ensuring compliance.',
      specialization: ['Tax Planning', 'Estate Planning', 'Business Strategy'],
      experience: 12,
      qualifications: ['JD', 'LLM in Taxation', 'EA'],
      rating: 4.9,
      totalReviews: 203,
      clientsCompleted: 1456,
      activeClients: 67,
      verified: true,
      socialLinks: {
        linkedin: 'https://linkedin.com/in/michaelchen-tax',
        website: 'https://michaelchentax.com'
      },
      availability: true,
      hourlyRate: 175,
      createdAt: new Date('2023-03-20')
    },
    {
      userId: 'advisor-3',
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@financelife.com',
      phone: '+1-555-0125',
      photo: '/api/placeholder/150/150',
      bio: 'Passionate about helping individuals achieve financial freedom through effective debt management strategies and credit improvement. Specialized in debt consolidation and financial education.',
      specialization: ['Debt Management', 'Credit Repair', 'Financial Education'],
      experience: 8,
      qualifications: ['BS in Finance', 'Certified Credit Counselor', 'CCC'],
      rating: 4.7,
      totalReviews: 89,
      clientsCompleted: 623,
      activeClients: 28,
      verified: true,
      socialLinks: {
        linkedin: 'https://linkedin.com/in/emilyrodriguez-finance'
      },
      availability: true,
      hourlyRate: 95,
      createdAt: new Date('2023-06-10')
    }
  ]);

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

  // Add demo todo lists
  const personalListId = await db.toDoLists.add({
    name: 'Personal Tasks',
    description: 'Daily personal tasks and errands',
    ownerId: userId ?? 'admin',
    createdAt: new Date('2026-01-15'),
    archived: false,
  });

  const financeListId = await db.toDoLists.add({
    name: 'Financial Goals',
    description: 'Money management and investment tasks',
    ownerId: userId ?? 'admin',
    createdAt: new Date('2026-01-20'),
    archived: false,
  });

  const workListId = await db.toDoLists.add({
    name: 'Work Projects',
    description: 'Professional tasks and deadlines',
    ownerId: userId ?? 'admin',
    createdAt: new Date('2026-02-01'),
    archived: false,
  });

  // Add demo todo items
  await db.toDoItems.bulkAdd([
    // Personal Tasks
    {
      listId: personalListId as number,
      title: 'Pay electricity bill',
      description: 'Monthly electricity payment due',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-02-15'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
    },
    {
      listId: personalListId as number,
      title: 'Schedule dentist appointment',
      description: 'Annual dental checkup',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-20'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-02'),
    },
    {
      listId: personalListId as number,
      title: 'Gym workout - 30 min cardio',
      completed: true,
      priority: 'low',
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-05'),
      completedAt: new Date('2026-02-05'),
    },
    {
      listId: personalListId as number,
      title: 'Buy groceries',
      description: 'Vegetables, fruits, milk',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-12'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-08'),
    },
    // Financial Goals
    {
      listId: financeListId as number,
      title: 'Review monthly budget',
      description: 'Analyze spending vs budget targets',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-02-28'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
    },
    {
      listId: financeListId as number,
      title: 'Set up automatic savings',
      description: 'Transfer ₹5000 monthly to savings',
      completed: true,
      priority: 'high',
      createdBy: 'demo-user',
      createdAt: new Date('2026-01-20'),
      completedAt: new Date('2026-01-25'),
    },
    {
      listId: financeListId as number,
      title: 'Research mutual funds',
      description: 'Compare top performing SIP options',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-18'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-05'),
    },
    {
      listId: financeListId as number,
      title: 'File tax returns',
      description: 'Gather documents and file ITR',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-03-31'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
    },
    // Work Projects
    {
      listId: workListId as number,
      title: 'Complete quarterly report',
      description: 'Q4 performance analysis',
      completed: true,
      priority: 'high',
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
      completedAt: new Date('2026-02-08'),
    },
    {
      listId: workListId as number,
      title: 'Team meeting preparation',
      description: 'Prepare slides for Monday standup',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-14'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-10'),
    },
    {
      listId: workListId as number,
      title: 'Client proposal review',
      description: 'Review and finalize project proposal',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-02-16'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-09'),
    },
  ]);

  if (isAdmin) {
    localStorage.setItem('admin_data_seeded_v2', 'true');
    console.log('Admin data seeded successfully');
  } else {
    console.log('Demo data initialized (Standard)');
  }
};

// Helper function to seed todo lists independently
async function seedToDoListsIfNeeded(userId: string = 'user') {
  const existingLists = await db.toDoLists.count();
  if (existingLists > 0) {
    return; // Already have todo lists
  }

  console.log('Seeding todo lists for existing user...');

  // Add todo lists with real user ID
  const personalListId = await db.toDoLists.add({
    name: 'Personal Tasks',
    description: 'Daily personal tasks and errands',
    ownerId: userId,
    createdAt: new Date(),
    archived: false,
  });

  const financeListId = await db.toDoLists.add({
    name: 'Financial Goals',
    description: 'Money management and investment tasks',
    ownerId: userId,
    createdAt: new Date(),
    archived: false,
  });

  const workListId = await db.toDoLists.add({
    name: 'Work Projects',
    description: 'Professional tasks and deadlines',
    ownerId: userId,
    createdAt: new Date(),
    archived: false,
  });

  // Add demo todo items
  await db.toDoItems.bulkAdd([
    // Personal Tasks
    {
      listId: personalListId as number,
      title: 'Pay electricity bill',
      description: 'Monthly electricity payment due',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-02-15'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
    },
    {
      listId: personalListId as number,
      title: 'Schedule dentist appointment',
      description: 'Annual dental checkup',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-20'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-02'),
    },
    {
      listId: personalListId as number,
      title: 'Gym workout - 30 min cardio',
      completed: true,
      priority: 'low',
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-05'),
      completedAt: new Date('2026-02-05'),
    },
    // Financial Goals
    {
      listId: financeListId as number,
      title: 'Review monthly budget',
      description: 'Analyze spending vs budget targets',
      completed: false,
      priority: 'high',
      dueDate: new Date('2026-02-28'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
    },
    {
      listId: financeListId as number,
      title: 'Set up automatic savings',
      description: 'Transfer ₹5000 monthly to savings',
      completed: true,
      priority: 'high',
      createdBy: 'demo-user',
      createdAt: new Date('2026-01-20'),
      completedAt: new Date('2026-01-25'),
    },
    // Work Projects
    {
      listId: workListId as number,
      title: 'Complete quarterly report',
      description: 'Q4 performance analysis',
      completed: true,
      priority: 'high',
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-01'),
      completedAt: new Date('2026-02-08'),
    },
    {
      listId: workListId as number,
      title: 'Team meeting preparation',
      description: 'Prepare slides for Monday standup',
      completed: false,
      priority: 'medium',
      dueDate: new Date('2026-02-14'),
      createdBy: 'demo-user',
      createdAt: new Date('2026-02-10'),
    },
  ]);

  console.log('Todo lists seeded successfully');
}
