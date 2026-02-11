import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { parseS1000DXml } from '../utils/xmlParser';
import { getWorkOrderByNum } from '../services/maximoClient';
import { buildViewerUrl } from '../services/s1000dService';
import type { S1000DLinkQuery } from '../schemas/s1000dSchema';
import type { ValidatedRequest } from '../middleware/validateRequest';

/** Response shape for S1000D link by work order */
interface WorkOrderLinkData {
  workOrder: string;
  asset: string;
  dmc: string;
  viewerUrl: string;
  serialNumber?: string;
}

/**
 * GET /link?wo=WO1001&sn=SERIAL (sn optional)
 * Query validated by middleware. Returns S1000D viewer link data for the given Work Order.
 * If serialNumber (sn) is provided, it is appended to the viewer URL for applicability.
 * Uses Maximo client (MOCK or REAL per APP_MODE).
 */
export async function getLinkForWorkOrder(req: ValidatedRequest, res: Response): Promise<void> {
  const { wo, sn } = req.validatedQuery as S1000DLinkQuery;
  const serialNumber = sn?.trim() || undefined;

  logger.info(`S1000D link request: wo=${wo}, sn=${serialNumber ?? '(none)'}`);

  const row = await getWorkOrderByNum(wo);

  if (!row) {
    res.status(404).json({ error: 'Work Order not found' });
    return;
  }

  const viewerUrl = buildViewerUrl(row.dmc, row.model, serialNumber);

  const body: WorkOrderLinkData = {
    workOrder: wo,
    asset: row.asset,
    dmc: row.dmc,
    viewerUrl,
  };
  if (serialNumber) {
    body.serialNumber = serialNumber;
  }

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
    const viewerUrl = buildViewerUrl(dmc, model);

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
