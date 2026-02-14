import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export { prisma };
