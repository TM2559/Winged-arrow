import { Response } from 'express';
import { logger } from '../utils/logger';
import { processProvisioningData } from '../services/s2000mService';
import { prisma } from '../lib/prisma';
import type { S2000MImportBody } from '../schemas/s2000mSchema';
import type { ValidatedRequest } from '../middleware/validateRequest';

/**
 * POST /api/v1/s2000m/import
 * Accepts S2000M provisioning data (validated by middleware), saves each part to DB (upsert by partNumber),
 * and simulates sending the payload to Maximo (logs only for now).
 */
export async function importProvisioningData(req: ValidatedRequest, res: Response): Promise<void> {
  const body = req.validatedBody as S2000MImportBody;

  logger.info('S2000M import request received');
  logger.info(`Received data: ${JSON.stringify(body)}`);

  const items = processProvisioningData(body);

  const savedIds: number[] = [];
  for (const part of body.parts) {
    const quantity = typeof part.quantity === 'number' ? part.quantity : 1;
    const name = part.description ?? '';
    const unit = part.unitOfMeasure ?? null;
    const saved = await prisma.sparePart.upsert({
      where: { partNumber: part.partNumber },
      create: {
        partNumber: part.partNumber,
        name,
        quantity,
        unit,
      },
      update: {
        name,
        quantity,
        unit,
      },
    });
    savedIds.push(saved.id);
    console.log('S2000M SparePart saved to database:', { id: saved.id, partNumber: saved.partNumber });
  }

  // Simulate Maximo API payload (log only; no actual API call yet)
  const maximoPayload = { item: items };
  logger.info(`Simulated Maximo API payload (${items.length} items): ${JSON.stringify(maximoPayload)}`);

  res.status(200).json({
    success: true,
    imported: body.parts.length,
    ids: savedIds,
    items,
    message: 'Parts saved to database; Maximo API integration pending.',
  });
}
