import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = databaseUrl.startsWith('file:')
  ? path.resolve(process.cwd(), databaseUrl.slice(5))
  : databaseUrl;

const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({
  adapter,
  log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export { prisma };
