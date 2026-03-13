import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { sanitize } from '../../utils/sanitize';
import { logger } from '../../config/logger';
import { cacheDeleteByPrefix } from '../../cache/redis';

export const getGoals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const goals = await prisma.goal.findMany({
      where: { userId, deletedAt: null },
      orderBy: { targetDate: 'asc' },
    });

    res.json({ success: true, data: goals });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch goals' });
  }
};

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, targetAmount, targetDate, category, isGroupGoal } = req.body;

    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const numericTarget = Number(targetAmount);
    if (!isFinite(numericTarget) || numericTarget <= 0) {
      return res.status(400).json({ success: false, error: 'Target amount must be a positive number' });
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        name: sanitize(name),
        targetAmount: numericTarget,
        targetDate: new Date(targetDate),
        category,
        isGroupGoal: isGroupGoal || false,
        currentAmount: 0,
      },
    });

    await cacheDeleteByPrefix('goals:');

    res.status(201).json({ success: true, data: goal });
  } catch (error) {
    logger.error('Failed to create goal', { error });
    res.status(500).json({ success: false, error: 'Failed to create goal' });
  }
};

export const getGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal || goal.userId !== userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ success: true, data: goal });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch goal' });
  }
};

export const updateGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body;

    // Verify ownership
    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal || goal.userId !== userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Whitelist only permitted fields to prevent mass assignment
    const allowedFields = ['name', 'targetAmount', 'currentAmount', 'targetDate', 'category', 'isGroupGoal', 'syncStatus'] as const;
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (updates.targetDate) updates.targetDate = new Date(updates.targetDate);

    const updated = await prisma.goal.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });

    await cacheDeleteByPrefix('goals:');

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update goal' });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal || goal.userId !== userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Soft delete
    await prisma.goal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await cacheDeleteByPrefix('goals:');

    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete goal' });
  }
};
