import { randomUUID } from 'crypto';
import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { logger } from '../../config/logger';

const ensureGroupsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS groups_expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      paid_by INTEGER,
      event_date TEXT NOT NULL,
      members_json TEXT NOT NULL,
      items_json TEXT,
      description TEXT,
      category TEXT,
      split_type TEXT,
      your_share REAL,
      status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_groups_expenses_user_id ON groups_expenses(user_id)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_groups_expenses_deleted_at ON groups_expenses(deleted_at)');
};

const toRow = (row: {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  paidBy: number | null;
  date: string;
  membersJson: string;
  itemsJson: string | null;
  description: string | null;
  category: string | null;
  splitType: string | null;
  yourShare: number | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}) => ({
  id: row.id,
  userId: row.userId,
  name: row.name,
  totalAmount: Number(row.totalAmount),
  paidBy: row.paidBy,
  date: new Date(row.date),
  members: JSON.parse(row.membersJson || '[]') as unknown[],
  items: row.itemsJson ? (JSON.parse(row.itemsJson) as unknown[]) : [],
  description: row.description,
  category: row.category,
  splitType: row.splitType,
  yourShare: row.yourShare,
  status: row.status || 'pending',
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

export const getGroups = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureGroupsTable();

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      name: string;
      totalAmount: number;
      paidBy: number | null;
      date: string;
      membersJson: string;
      itemsJson: string | null;
      description: string | null;
      category: string | null;
      splitType: string | null;
      yourShare: number | null;
      status: string | null;
      createdAt: string;
      updatedAt: string;
    }>>`
      SELECT
        id,
        user_id as userId,
        name,
        total_amount as totalAmount,
        paid_by as paidBy,
        event_date as date,
        members_json as membersJson,
        items_json as itemsJson,
        description,
        category,
        split_type as splitType,
        your_share as yourShare,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM groups_expenses
      WHERE user_id = ${userId} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    res.json({ success: true, data: rows.map(toRow) });
  } catch (error) {
    logger.error('Failed to fetch groups', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch groups' });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureGroupsTable();

    const body = req.body as {
      name: string;
      totalAmount: number;
      paidBy?: number;
      date: string;
      members: unknown[];
      items?: unknown[];
      description?: string;
      category?: string;
      splitType?: string;
      yourShare?: number;
      status?: string;
    };

    const id = randomUUID();
    const nowIso = new Date().toISOString();

    await prisma.$executeRaw`
      INSERT INTO groups_expenses (
        id, user_id, name, total_amount, paid_by, event_date,
        members_json, items_json, description, category, split_type,
        your_share, status, created_at, updated_at
      )
      VALUES (
        ${id}, ${userId}, ${body.name}, ${body.totalAmount}, ${body.paidBy ?? null}, ${new Date(body.date).toISOString()},
        ${JSON.stringify(body.members)}, ${JSON.stringify(body.items ?? [])}, ${body.description ?? null}, ${body.category ?? null}, ${body.splitType ?? 'equal'},
        ${body.yourShare ?? null}, ${body.status ?? 'pending'}, ${nowIso}, ${nowIso}
      )
    `;

    const [row] = await prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      name: string;
      totalAmount: number;
      paidBy: number | null;
      date: string;
      membersJson: string;
      itemsJson: string | null;
      description: string | null;
      category: string | null;
      splitType: string | null;
      yourShare: number | null;
      status: string | null;
      createdAt: string;
      updatedAt: string;
    }>>`
      SELECT
        id,
        user_id as userId,
        name,
        total_amount as totalAmount,
        paid_by as paidBy,
        event_date as date,
        members_json as membersJson,
        items_json as itemsJson,
        description,
        category,
        split_type as splitType,
        your_share as yourShare,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM groups_expenses
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;

    res.status(201).json({ success: true, data: row ? toRow(row) : null });
  } catch (error) {
    logger.error('Failed to create group', { error });
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await ensureGroupsTable();

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM groups_expenses WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL LIMIT 1
    `;

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const body = req.body as {
      name?: string;
      totalAmount?: number;
      paidBy?: number;
      date?: string;
      members?: unknown[];
      items?: unknown[];
      description?: string;
      category?: string;
      splitType?: string;
      yourShare?: number;
      status?: string;
    };

    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
    if (body.totalAmount !== undefined) { updates.push('total_amount = ?'); values.push(body.totalAmount); }
    if (body.paidBy !== undefined) { updates.push('paid_by = ?'); values.push(body.paidBy); }
    if (body.date !== undefined) { updates.push('event_date = ?'); values.push(new Date(body.date).toISOString()); }
    if (body.members !== undefined) { updates.push('members_json = ?'); values.push(JSON.stringify(body.members)); }
    if (body.items !== undefined) { updates.push('items_json = ?'); values.push(JSON.stringify(body.items)); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.category !== undefined) { updates.push('category = ?'); values.push(body.category); }
    if (body.splitType !== undefined) { updates.push('split_type = ?'); values.push(body.splitType); }
    if (body.yourShare !== undefined) { updates.push('your_share = ?'); values.push(body.yourShare); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id, userId);

    const query = `
      UPDATE groups_expenses
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `;

    await prisma.$executeRawUnsafe(query, ...values);

    const [row] = await prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      name: string;
      totalAmount: number;
      paidBy: number | null;
      date: string;
      membersJson: string;
      itemsJson: string | null;
      description: string | null;
      category: string | null;
      splitType: string | null;
      yourShare: number | null;
      status: string | null;
      createdAt: string;
      updatedAt: string;
    }>>`
      SELECT
        id,
        user_id as userId,
        name,
        total_amount as totalAmount,
        paid_by as paidBy,
        event_date as date,
        members_json as membersJson,
        items_json as itemsJson,
        description,
        category,
        split_type as splitType,
        your_share as yourShare,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM groups_expenses
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `;

    res.json({ success: true, data: row ? toRow(row) : null });
  } catch (error) {
    logger.error('Failed to update group', { error });
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    await ensureGroupsTable();

    await prisma.$executeRaw`
      UPDATE groups_expenses
      SET deleted_at = ${new Date().toISOString()}, updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    `;

    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    logger.error('Failed to delete group', { error });
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
};
