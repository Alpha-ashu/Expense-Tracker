import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { isDatabaseUnavailableError } from '../../utils/databaseAvailability';

const toDate = (value?: string) => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const getInvestments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const investments = await prisma.investment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { purchaseDate: 'desc' },
    });

    res.json({ success: true, data: investments });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return res.json({ success: true, data: [] });
    }

    res.status(500).json({ success: false, error: 'Failed to fetch investments' });
  }
};

export const createInvestment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const body = req.body as {
      assetType: string;
      assetName: string;
      quantity: number;
      buyPrice: number;
      currentPrice: number;
      totalInvested?: number;
      currentValue?: number;
      profitLoss?: number;
      purchaseDate: string;
      lastUpdated?: string;
    };

    const totalInvested = body.totalInvested ?? body.quantity * body.buyPrice;
    const currentValue = body.currentValue ?? body.quantity * body.currentPrice;
    const profitLoss = body.profitLoss ?? currentValue - totalInvested;

    const created = await prisma.investment.create({
      data: {
        userId,
        assetType: body.assetType,
        assetName: body.assetName,
        quantity: body.quantity,
        buyPrice: body.buyPrice,
        currentPrice: body.currentPrice,
        totalInvested,
        currentValue,
        profitLoss,
        purchaseDate: toDate(body.purchaseDate),
        lastUpdated: toDate(body.lastUpdated),
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create investment' });
  }
};

export const updateInvestment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const existing = await prisma.investment.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Investment not found' });
    }

    const updates: Record<string, unknown> = { ...body, lastUpdated: new Date(), updatedAt: new Date() };
    if (typeof updates.purchaseDate === 'string') updates.purchaseDate = toDate(updates.purchaseDate);
    if (typeof updates.lastUpdated === 'string') updates.lastUpdated = toDate(updates.lastUpdated);

    const updated = await prisma.investment.update({
      where: { id },
      data: updates,
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update investment' });
  }
};

export const deleteInvestment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const existing = await prisma.investment.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Investment not found' });
    }

    await prisma.investment.update({
      where: { id },
      data: { deletedAt: new Date(), updatedAt: new Date() },
    });

    res.json({ success: true, message: 'Investment deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete investment' });
  }
};
