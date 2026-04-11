import { config } from 'dotenv';

// Load .env before PrismaClient instantiation — Prisma reads DATABASE_URL at import time.
// ts-node-dev runs from the backend/ directory, so .env is in the cwd.
config();

import { PrismaClient } from './prisma-client';

// Lazy singleton — instantiated on first use rather than at module load time.
// This prevents Vercel cold-start crashes when DATABASE_URL is missing or the
// binary hasn't been generated yet, allowing other (non-DB) routes to still work.
let _prisma: PrismaClient | null = null;

const getPrismaClient = (): PrismaClient => {
  if (!_prisma) {
    try {
      _prisma = new PrismaClient();
    } catch (err) {
      console.error('[prisma] Failed to instantiate PrismaClient:', err);
      throw err;
    }
  }
  return _prisma;
};

// Proxy that delegates all property access to the lazily-created client.
// Existing code that does `prisma.user.findUnique(...)` will continue to work.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
