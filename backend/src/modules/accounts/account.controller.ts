import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const accounts = await prisma.account.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, type, balance, currency } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name,
        type,
        balance: balance || 0,
        currency: currency || 'USD',
        isActive: true,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    console.error('Failed to create account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
};

export const getAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account || account.userId !== userId) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Soft delete
    await prisma.account.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    res.json({ message: 'Account deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
