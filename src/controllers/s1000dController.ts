import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const PORT = Number(process.env.PORT) || 3000;
const VIEWER_BASE = `http://localhost:${PORT}/viewer/index.html`;

/** Mock lookup result for a work order */
interface WorkOrderLinkData {
  workOrder: string;
  asset: string;
  dmc: string;
  viewerUrl: string;
}

/**
 * Mock database: only WO1001 is known.
 * Replace with real Maximo/DB lookup later.
 */
const MOCK_DB: Record<string, { asset: string; dmc: string; model: string }> = {
  WO1001: {
    asset: '109E-LOC-01',
    dmc: 'DMC-SKODA-BRZDA-MAIN-01',
    model: '109E',
  },
};

/**
 * GET /link?wo=WO1001
 * Returns S1000D viewer link data for the given Work Order.
 */
export function getLinkForWorkOrder(req: Request, res: Response): void {
  const wo = typeof req.query.wo === 'string' ? req.query.wo.trim() : undefined;

  logger.info(`S1000D link request: wo=${wo ?? '(missing)'}`);

  if (!wo) {
    res.status(400).json({
      error: 'Missing required query parameter: wo',
      example: '/api/v1/s1000d/link?wo=WO1001',
    });
    return;
  }

  const row = MOCK_DB[wo];

  if (!row) {
    res.status(404).json({ error: 'Work Order not found' });
    return;
  }

  const viewerUrl = `${VIEWER_BASE}?dmc=${encodeURIComponent(row.dmc)}&model=${encodeURIComponent(row.model)}`;

  const body: WorkOrderLinkData = {
    workOrder: wo,
    asset: row.asset,
    dmc: row.dmc,
    viewerUrl,
  };

  res.status(200).json(body);
}
