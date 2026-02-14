import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { parseDataModule } from '../utils/s1000dParser';
import { getWorkOrderByNum } from '../services/maximoClient';
import { buildViewerUrl } from '../services/s1000dService';
import { prisma } from '../lib/prisma';
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

function looksLikeXml(value: string): boolean {
  const t = value.trimStart();
  return t.startsWith('<?xml') || t.startsWith('<');
}

/** Derive a short model identifier from DMC (e.g. first segment or default). */
function modelFromDmc(dmCode: string): string {
  const part = dmCode.split(/[-_]/)[0];
  return part && part !== 'DMC' ? part : 'default';
}

/**
 * POST /upload (application/xml body)
 * Receives XML in req.body (parsed by express.text({ type: 'application/xml' })).
 * Parses metadata, saves/updates DataModule in DB (upsert by dmCode), returns JSON with id and viewer URL.
 */
export async function uploadDataModule(req: Request, res: Response): Promise<void> {
  const xmlContent = req.body;
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    res.status(400).json({
      error: 'Missing XML body',
      hint: 'Send a request with Content-Type: application/xml and the S1000D data module XML as body.',
    });
    return;
  }

  logger.info('S1000D upload: XML body (application/xml)');

  try {
    const metadata = parseDataModule(xmlContent);
    const issueDate = metadata.issueDate?.trim() || null;
    const techName = metadata.techName?.trim() || null;

    const saved = await prisma.dataModule.upsert({
      where: { dmCode: metadata.dmCode },
      create: {
        dmCode: metadata.dmCode,
        issueDate,
        techName,
        xmlContent,
      },
      update: {
        issueDate,
        techName,
        xmlContent,
      },
    });

    console.log('S1000D DataModule saved to database:', { id: saved.id, dmCode: saved.dmCode });

    const model = modelFromDmc(metadata.dmCode);
    const viewerUrl = buildViewerUrl(metadata.dmCode, model);

    res.status(200).json({
      ...metadata,
      id: saved.id,
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

/**
 * POST /upload (multipart file)
 * Accepts an S1000D XML file via multipart/form-data. Parses, saves/updates DataModule in DB (upsert by dmCode), returns id + viewer URL.
 */
export async function uploadS1000DXml(req: Request, res: Response): Promise<void> {
  const multerReq = req as Request & { file?: Express.Multer.File; files?: Express.Multer.File[] };
  const file = multerReq.files?.[0] ?? multerReq.file;

  if (!file?.buffer) {
    res.status(400).json({
      error: 'No file uploaded',
      hint: 'Send multipart/form-data with field "xml" or "file" containing an S1000D XML file.',
    });
    return;
  }

  const xmlString = file.buffer.toString('utf8');
  logger.info(`S1000D upload: ${file.originalname}, size=${file.size}`);

  try {
    const metadata = parseDataModule(xmlString);
    const issueDate = metadata.issueDate?.trim() || null;
    const techName = metadata.techName?.trim() || null;

    const saved = await prisma.dataModule.upsert({
      where: { dmCode: metadata.dmCode },
      create: {
        dmCode: metadata.dmCode,
        issueDate,
        techName,
        xmlContent: xmlString,
      },
      update: {
        issueDate,
        techName,
        xmlContent: xmlString,
      },
    });

    console.log('S1000D DataModule saved to database:', { id: saved.id, dmCode: saved.dmCode });

    const model = modelFromDmc(metadata.dmCode);
    const viewerUrl = buildViewerUrl(metadata.dmCode, model);

    res.status(200).json({
      ...metadata,
      id: saved.id,
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
