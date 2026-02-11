import { Response } from 'express';
import { logger } from '../utils/logger';
import { processProvisioningData } from '../services/s2000mService';
import type { S2000MImportBody } from '../schemas/s2000mSchema';
import type { ValidatedRequest } from '../middleware/validateRequest';

/**
 * POST /api/v1/s2000m/import
 * Accepts S2000M provisioning data (validated by middleware), maps to Maximo Item Master,
 * and simulates sending the payload to Maximo (logs only for now).
 */
export function importProvisioningData(req: ValidatedRequest, res: Response): void {
  const body = req.validatedBody as S2000MImportBody;

  logger.info('S2000M import request received');
  logger.info(`Received data: ${JSON.stringify(body)}`);

  const items = processProvisioningData(body);

  // Simulate Maximo API payload (log only; no actual API call yet)
  const maximoPayload = { item: items };
  logger.info(`Simulated Maximo API payload (${items.length} items): ${JSON.stringify(maximoPayload)}`);

  res.status(200).json({
    success: true,
    imported: items.length,
    items,
    message: 'Payload logged; Maximo API integration pending.',
  });
}
