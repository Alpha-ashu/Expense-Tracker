import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { Prisma } from '@prisma/client';
import { cacheDeleteByPrefix } from '../../cache/redis';

interface HttpLikeError {
  statusCode?: number;
  message?: string;
}

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { accountId, startDate, endDate, category, page, limit } = req.query;

    const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };

    if (accountId) where.accountId = accountId as string;
    if (category) where.category = category as string;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate as string);
      if (endDate) where.date.lte = new Date(endDate as string);
    }

    // Pagination — default 50 items per page, max 200
    const pageNum = Math.max(1, parseInt((page as string) || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt((limit as string) || '50', 10)));
    const skip = (pageNum - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        include: { account: true },
        skip,
        take: pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
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

    const numericAmount = Number(amount);

    // Wrap all balance updates + transaction creation in an atomic DB transaction
    const transaction = await prisma.$transaction(async (tx) => {
      if (type === 'transfer' && transferToAccountId) {
        // Validate destination account ownership
        const destinationAccount = await tx.account.findUnique({
          where: { id: transferToAccountId },
        });
        if (!destinationAccount || destinationAccount.userId !== userId) {
          throw Object.assign(new Error('Invalid destination account'), { statusCode: 403 });
        }

        // Validate source account ownership
        const sourceAccount = await tx.account.findUnique({
          where: { id: accountId },
        });
        if (!sourceAccount || sourceAccount.userId !== userId) {
          throw Object.assign(new Error('Invalid source account'), { statusCode: 403 });
        }

        if (sourceAccount.balance < numericAmount) {
          throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });
        }

        // Update both balances atomically
        await tx.account.update({
          where: { id: accountId },
          data: { balance: sourceAccount.balance - numericAmount },
        });
        await tx.account.update({
          where: { id: transferToAccountId },
          data: { balance: destinationAccount.balance + numericAmount },
        });
      } else {
        // Validate account ownership
        const account = await tx.account.findUnique({
          where: { id: accountId },
        });
        if (!account || account.userId !== userId) {
          throw Object.assign(new Error('Invalid account'), { statusCode: 403 });
        }

        const balanceAdjustment = type === 'income' ? numericAmount : -numericAmount;
        await tx.account.update({
          where: { id: accountId },
          data: { balance: account.balance + balanceAdjustment },
        });
      }

      // Create transaction record inside the same atomic unit
      return tx.transaction.create({
        data: {
          userId,
          accountId,
          type,
          amount: numericAmount,
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
    });

    await cacheDeleteByPrefix('transactions:');

    res.status(201).json(transaction);
  } catch (error: unknown) {
    const typedError = error as HttpLikeError;
    if (typedError.statusCode === 403) {
      return res.status(403).json({ error: typedError.message || 'Forbidden' });
    }
    if (typedError.statusCode === 400) {
      return res.status(400).json({ error: typedError.message || 'Bad request' });
    }
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

    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
};

export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    // Whitelist only updatable fields to prevent field injection
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'type', 'amount', 'category', 'subcategory',
      'description', 'merchant', 'date', 'tags',
      'transferToAccountId', 'transferType',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    if (updates.date !== undefined) {
      updates.date = new Date(String(updates.date));
    }

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

    await cacheDeleteByPrefix('transactions:');

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update transaction' });
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

    await cacheDeleteByPrefix('transactions:');

    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete transaction' });
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
