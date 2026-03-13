import { randomUUID } from 'crypto';
import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { sanitize } from '../../utils/sanitize';
import { logger } from '../../config/logger';

const ensureFriendsTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_friends_deleted_at ON friends(deleted_at)');
};

export const getFriends = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureFriendsTable();

    const friends = await prisma.$queryRaw<any[]>`
      SELECT id, user_id as userId, name, email, phone, created_at as createdAt, updated_at as updatedAt
      FROM friends
      WHERE user_id = ${userId} AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    res.json({ success: true, data: friends });
  } catch (error) {
    logger.error('Failed to fetch friends', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch friends' });
  }
};

export const createFriend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureFriendsTable();

    const name = String(req.body?.name || '').trim();
    const email = req.body?.email ? String(req.body.email).trim() : null;
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    if (!email && !phone) {
      return res.status(400).json({ success: false, error: 'Email or phone is required' });
    }

    const nowIso = new Date().toISOString();
    const id = randomUUID();

    await prisma.$executeRaw`
      INSERT INTO friends (id, user_id, name, email, phone, created_at, updated_at)
      VALUES (${id}, ${userId}, ${sanitize(name)}, ${email}, ${phone}, ${nowIso}, ${nowIso})
    `;

    const [friend] = await prisma.$queryRaw<any[]>`
      SELECT id, user_id as userId, name, email, phone, created_at as createdAt, updated_at as updatedAt
      FROM friends
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;

    res.status(201).json({ success: true, data: friend ?? null });
  } catch (error) {
    logger.error('Failed to create friend', { error });
    res.status(500).json({ success: false, error: 'Failed to create friend' });
  }
};

export const updateFriend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureFriendsTable();

    const friendId = String(req.params.id || '').trim();
    const name = req.body?.name ? String(req.body.name).trim() : undefined;
    const email = req.body?.email !== undefined ? (String(req.body.email).trim() || null) : undefined;
    const phone = req.body?.phone !== undefined ? (String(req.body.phone).trim() || null) : undefined;

    if (!friendId) {
      return res.status(400).json({ success: false, error: 'Friend id is required' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(sanitize(name));
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(friendId, userId);

    const query = `
      UPDATE friends
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `;

    await prisma.$executeRawUnsafe(query, ...values);

    const [friend] = await prisma.$queryRaw<any[]>`
      SELECT id, user_id as userId, name, email, phone, created_at as createdAt, updated_at as updatedAt
      FROM friends
      WHERE id = ${friendId} AND user_id = ${userId} AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!friend) {
      return res.status(404).json({ success: false, error: 'Friend not found' });
    }

    res.json({ success: true, data: friend });
  } catch (error) {
    logger.error('Failed to update friend', { error });
    res.status(500).json({ success: false, error: 'Failed to update friend' });
  }
};

export const deleteFriend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    await ensureFriendsTable();

    const friendId = String(req.params.id || '').trim();
    if (!friendId) {
      return res.status(400).json({ success: false, error: 'Friend id is required' });
    }

    await prisma.$executeRaw`
      UPDATE friends
      SET deleted_at = ${new Date().toISOString()}, updated_at = ${new Date().toISOString()}
      WHERE id = ${friendId} AND user_id = ${userId} AND deleted_at IS NULL
    `;

    res.json({ success: true, message: 'Friend deleted' });
  } catch (error) {
    logger.error('Failed to delete friend', { error });
    res.status(500).json({ success: false, error: 'Failed to delete friend' });
  }
};
