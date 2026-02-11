import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { processProvisioningData } from '../services/s2000mService';

/**
 * POST /api/v1/s2000m/import
 * Accepts S2000M provisioning data, maps to Maximo Item Master, and simulates
 * sending the payload to Maximo (logs only for now).
 */
export function importProvisioningData(req: Request, res: Response): void {
  const body = req.body;

  logger.info('S2000M import request received');
  logger.info(`Received data: ${JSON.stringify(body ?? '(empty)')}`);

  if (!body) {
    res.status(400).json({
      error: 'Missing request body',
      example: { parts: [{ partNumber: '...', description: '...', unitOfMeasure: '...' }] },
    });
    return;
  }

  const items = processProvisioningData(body);

  if (items.length === 0) {
    res.status(400).json({
      error: 'No parts to import',
      hint: 'Send an array of parts or an object with a "parts" array.',
    });
    return;
  }

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
