import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface SearchResult {
  id: number;
  dmCode: string;
  techName: string | null;
}

/**
 * Runs full-text search over DataModule (techName and xmlContent).
 * Case-insensitive via LOWER() for Czech and other Unicode (e.g. "brzda", "šroub").
 * Note: infoName is not a column; it lives inside xmlContent and is matched there.
 */
export async function getSearchResults(q: string): Promise<SearchResult[]> {
  const term = (q || '').trim();
  if (!term) return [];

  const pattern = `%${term.toLowerCase()}%`;

  try {
    const rows = await prisma.$queryRaw<SearchResult[]>`
      SELECT id, dmCode, techName
      FROM DataModule
      WHERE (techName IS NOT NULL AND LOWER(techName) LIKE ${pattern})
         OR (LOWER(xmlContent) LIKE ${pattern})
      ORDER BY dmCode ASC
    `;
    return rows;
  } catch (err) {
    logger.error('getSearchResults error', err);
    return [];
  }
}

/**
 * GET /api/search?q=...
 * Returns JSON: { results: [{ id, dmCode, techName }, ...] }
 */
export async function search(req: Request, res: Response): Promise<void> {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const results = await getSearchResults(q);
  res.json({ results });
}
