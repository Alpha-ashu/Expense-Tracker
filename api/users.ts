import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
}
