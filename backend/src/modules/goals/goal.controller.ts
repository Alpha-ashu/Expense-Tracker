import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';

export const getGoals = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const goals = await prisma.goal.findMany({
      where: { userId, deletedAt: null },
      orderBy: { targetDate: 'asc' },
    });

    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
};

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { name, targetAmount, targetDate, category, isGroupGoal } = req.body;

    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const goal = await prisma.goal.create({
      data: {
        userId,
        name,
        targetAmount,
        targetDate: new Date(targetDate),
        category,
        isGroupGoal: isGroupGoal || false,
        currentAmount: 0,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    console.error('Failed to create goal:', error);
    res.status(500).json({ error: 'Failed to create goal' });
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

    res.json(goal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch goal' });
  }
};

export const updateGoal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal || goal.userId !== userId) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updated = await prisma.goal.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update goal' });
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

    res.json({ message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
};
