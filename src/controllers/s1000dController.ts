import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { parseS1000DXml } from '../utils/xmlParser';
import { getWorkOrderByNum } from '../services/maximoClient';

const PORT = Number(process.env.PORT) || 3000;
const VIEWER_BASE = `http://localhost:${PORT}/viewer/index.html`;

/** Response shape for S1000D link by work order */
interface WorkOrderLinkData {
  workOrder: string;
  asset: string;
  dmc: string;
  viewerUrl: string;
}

/**
 * GET /link?wo=WO1001
 * Returns S1000D viewer link data for the given Work Order.
 * Uses Maximo client (MOCK or REAL per APP_MODE).
 */
export async function getLinkForWorkOrder(req: Request, res: Response): Promise<void> {
  const wo = typeof req.query.wo === 'string' ? req.query.wo.trim() : undefined;

  logger.info(`S1000D link request: wo=${wo ?? '(missing)'}`);

  if (!wo) {
    res.status(400).json({
      error: 'Missing required query parameter: wo',
      example: '/api/v1/s1000d/link?wo=WO1001',
    });
    return;
  }

  const row = await getWorkOrderByNum(wo);

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

/** Derive a short model identifier from DMC (e.g. first segment or default). */
function modelFromDmc(dmc: string): string {
  const part = dmc.split(/[-_]/)[0];
  return part && part !== 'DMC' ? part : 'default';
}

/**
 * POST /upload
 * Accepts an S1000D XML file (multipart/form-data, field "xml" or "file").
 * Returns the generated Navigator (viewer) URL based on the DMC found in the XML.
 */
export function uploadS1000DXml(req: Request, res: Response): void {
  const multerReq = req as Request & { file?: Express.Multer.File; files?: Express.Multer.File[] };
  const file = multerReq.files?.[0] ?? multerReq.file;

  if (!file || !file.buffer) {
    res.status(400).json({
      error: 'No file uploaded',
      hint: 'Send multipart/form-data with field "xml" or "file" containing an S1000D XML file.',
    });
    return;
  }

  const xmlString = file.buffer.toString('utf8');
  logger.info(`S1000D upload: ${file.originalname}, size=${file.size}`);

  try {
    const { dmc, title } = parseS1000DXml(xmlString);
    const model = modelFromDmc(dmc);
    const viewerUrl = `${VIEWER_BASE}?dmc=${encodeURIComponent(dmc)}&model=${encodeURIComponent(model)}`;

    res.status(200).json({
      dmc,
      title,
      model,
      viewerUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse S1000D XML';
    logger.warn(`S1000D upload parse error: ${message}`);
    res.status(400).json({
      error: 'Invalid S1000D XML',
      detail: message,
    });
  }
}
