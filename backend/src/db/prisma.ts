import { config } from 'dotenv';

// Load .env before PrismaClient instantiation — Prisma reads DATABASE_URL at import time
// ts-node-dev runs from the backend/ directory, so .env is in the cwd
config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export { prisma };
