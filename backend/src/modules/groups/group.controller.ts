import { randomUUID } from 'crypto';
import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';

// Helper to convert internal Prisma model to the response format
const toResponse = (item: any) => ({
  id: item.id,
  userId: item.userId,
  name: item.name,
  totalAmount: item.totalAmount,
  paidBy: item.paidBy,
  date: item.date,
  members: item.members ? JSON.parse(item.members) : [],
  items: item.items ? JSON.parse(item.items) : [],
  description: item.description,
  category: item.category,
  splitType: item.splitType,
  yourShare: item.yourShare,
  status: item.status || 'pending',
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export const getGroups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const groups = await prisma.groupExpense.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: groups.map(toResponse) });
  } catch (error) {
    logger.error('Failed to fetch groups', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const body = req.body;

    const group = await prisma.groupExpense.create({
      data: {
        id: randomUUID(),
        userId,
        name: body.name,
        totalAmount: body.totalAmount,
        paidBy: body.paidBy ? String(body.paidBy) : null,
        date: new Date(body.date),
        members: JSON.stringify(body.members || []),
        items: JSON.stringify(body.items || []),
        description: body.description,
        category: body.category,
        splitType: body.splitType || 'equal',
        yourShare: body.yourShare,
        status: body.status || 'pending',
        syncStatus: 'synced'
      }
    });

    res.status(201).json({ success: true, data: toResponse(group) });
  } catch (error) {
    logger.error('Failed to create group', { error });
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body;

    // Verify ownership and existence
    const existing = await prisma.groupExpense.findFirst({
      where: { id, userId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const updated = await prisma.groupExpense.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        totalAmount: body.totalAmount !== undefined ? body.totalAmount : undefined,
        paidBy: body.paidBy !== undefined ? (body.paidBy ? String(body.paidBy) : null) : undefined,
        date: body.date !== undefined ? new Date(body.date) : undefined,
        members: body.members !== undefined ? JSON.stringify(body.members) : undefined,
        items: body.items !== undefined ? JSON.stringify(body.items) : undefined,
        description: body.description !== undefined ? body.description : undefined,
        category: body.category !== undefined ? body.category : undefined,
        splitType: body.splitType !== undefined ? body.splitType : undefined,
        yourShare: body.yourShare !== undefined ? body.yourShare : undefined,
        status: body.status !== undefined ? body.status : undefined,
        updatedAt: new Date()
      }
    });

    res.json({ success: true, data: toResponse(updated) });
  } catch (error) {
    logger.error('Failed to update group', { error });
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const existing = await prisma.groupExpense.findFirst({
      where: { id, userId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    await prisma.groupExpense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    logger.error('Failed to delete group', { error });
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
};
