import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { accountId, startDate, endDate, category } = req.query;

    const where: any = { userId };

    if (accountId) where.accountId = accountId as string;
    if (category) where.category = category as string;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { account: true },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const {
      accountId,
      type,
      amount,
      category,
      subcategory,
      description,
      merchant,
      date,
      tags,
      transferToAccountId,
      transferType,
    } = req.body;

    // Validate required fields
    if (!accountId || !type || !amount || !category || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // For transfers, validate destination account and user ownership
    if (type === 'transfer' && transferToAccountId) {
      const destinationAccount = await prisma.account.findUnique({
        where: { id: transferToAccountId },
      });

      if (!destinationAccount || destinationAccount.userId !== userId) {
        return res.status(403).json({ error: 'Invalid destination account' });
      }

      // Update both account balances
      const sourceAccount = await prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!sourceAccount || sourceAccount.userId !== userId) {
        return res.status(403).json({ error: 'Invalid source account' });
      }

      if (sourceAccount.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Create transfer transactions
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: sourceAccount.balance - amount },
      });

      await prisma.account.update({
        where: { id: transferToAccountId },
        data: { balance: destinationAccount.balance + amount },
      });
    } else {
      // Update account balance for non-transfer transactions
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account || account.userId !== userId) {
        return res.status(403).json({ error: 'Invalid account' });
      }

      const balanceAdjustment = type === 'income' ? amount : -amount;
      await prisma.account.update({
        where: { id: accountId },
        data: { balance: account.balance + balanceAdjustment },
      });
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        type,
        amount,
        category,
        subcategory,
        description,
        merchant,
        date: new Date(date),
        tags: tags || [],
        transferToAccountId,
        transferType,
        synced: true,
      },
      include: { account: true },
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Failed to create transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

export const getTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: updates,
      include: { account: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Soft delete
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};

export const getAccountTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { accountId } = req.params;

    // Verify account ownership
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const transactions = await prisma.transaction.findMany({
      where: { accountId, userId },
      orderBy: { date: 'desc' },
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account transactions' });
  }
};
