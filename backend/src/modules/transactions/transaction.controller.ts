import { Response } from 'express';
import { createHash } from 'crypto';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { Prisma } from '../../db/prisma-client';
import { cacheDeleteByPrefix } from '../../cache/redis';
import { eventBus } from '../../utils/eventBus';
import { isDatabaseUnavailableError } from '../../utils/databaseAvailability';

interface HttpLikeError {
  statusCode?: number;
  message?: string;
}

type TransactionWithTags = {
  tags?: string | null;
  [key: string]: unknown;
};

/** SHA-256 dedup hash: userId + amount + date(YYYY-MM-DD) + description */
function generateDedupHash(userId: string, amount: number, date: Date, description?: string): string {
  const dateStr = date.toISOString().slice(0, 10);
  const payload = `${userId}:${amount}:${dateStr}:${description ?? ''}`;
  return createHash('sha256').update(payload).digest('hex');
}

function serializeTags(tags: unknown): string | null {
  if (tags == null) return null;

  if (Array.isArray(tags)) {
    const normalized = tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
    return normalized.length > 0 ? JSON.stringify(normalized) : null;
  }

  if (typeof tags === 'string') {
    const trimmed = tags.trim();
    return trimmed || null;
  }

  return null;
}

function deserializeTags(tags: string | null | undefined): string[] {
  if (!tags) return [];

  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed
        .map((tag) => String(tag).trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated parsing for legacy values.
  }

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeTransaction<T extends TransactionWithTags>(transaction: T): Omit<T, 'tags'> & { tags: string[] } {
  return {
    ...transaction,
    tags: deserializeTags(transaction.tags),
  };
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
      data: transactions.map(normalizeTransaction),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0,
        },
      });
    }

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

    // BUG FIX #4: Round to 2 decimal places to prevent floating-point precision errors
    // e.g., 200.17 saved as 199.80 due to IEEE 754 floating-point representation
    const numericAmount = Math.round(Number(amount) * 100) / 100;

    // Validate amount is positive and finite
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Transaction amount must be a positive number' });
    }

    const txDate = new Date(date);
    const serializedTags = serializeTags(tags);
    const dedupHash = generateDedupHash(userId, numericAmount, txDate, description);

    // Check for duplicate transaction
    const existingDup = await prisma.transaction.findUnique({
      where: { dedupHash },
    });
    if (existingDup) {
      return res.status(409).json({ error: 'Duplicate transaction detected', existingId: existingDup.id });
    }

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
          date: txDate,
          tags: serializedTags,
          transferToAccountId,
          transferType,
          dedupHash,
          synced: true,
        },
        include: { account: true },
      });
    });

    await cacheDeleteByPrefix('transactions:');

    eventBus.emit({
      type: 'TRANSACTION_CREATED',
      payload: { userId, transactionId: transaction.id, accountId, amount: numericAmount, category },
    });

    res.status(201).json(normalizeTransaction(transaction));
  } catch (error: unknown) {
    const typedError = error as HttpLikeError;
    if (typedError.statusCode === 403) {
      return res.status(403).json({ error: typedError.message || 'Forbidden' });
    }
    if (typedError.statusCode === 400) {
      return res.status(400).json({ error: typedError.message || 'Bad request' });
    }
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

export const getTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: { account: true },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, data: normalizeTransaction(transaction) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
};

export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    // Validate amount if provided: must be positive and finite
    if (body.amount !== undefined) {
      const numAmount = Number(body.amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Transaction amount must be a positive number' });
      }
    }

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
    if (updates.tags !== undefined) {
      updates.tags = serializeTags(updates.tags);
    }

    // Verify ownership
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...updates,
        version: { increment: 1 },
      },
      include: { account: true },
    });

    await cacheDeleteByPrefix('transactions:');

    eventBus.emit({ type: 'TRANSACTION_UPDATED', payload: { userId, transactionId: id } });

    res.json({ success: true, data: normalizeTransaction(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update transaction' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Soft delete
    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await cacheDeleteByPrefix('transactions:');

    eventBus.emit({ type: 'TRANSACTION_DELETED', payload: { userId, transactionId: id, accountId: transaction.accountId } });

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

    res.json(transactions.map(normalizeTransaction));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account transactions' });
  }
};
