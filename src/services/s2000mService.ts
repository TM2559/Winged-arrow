import { logger } from '../utils/logger';

/** S2000M provisioning part (input format) */
export interface S2000MPart {
  partNumber: string;
  description: string;
  unitOfMeasure: string;
}

/** Maximo Item Master (output format for import) */
export interface MaximoItemMaster {
  itemnum: string;
  description: string;
  orderunit: string;
}

/**
 * Maps a single S2000M part to Maximo Item Master fields.
 */
function mapPartToMaximoItem(part: S2000MPart): MaximoItemMaster {
  return {
    itemnum: part.partNumber,
    description: part.description,
    orderunit: part.unitOfMeasure,
  };
}

/**
 * Processes S2000M provisioning data: maps parts to Maximo Item Master format
 * and logs each processed item.
 *
 * @param data - Array of S2000M parts (or raw payload with parts array)
 * @returns Array of Maximo Item Master records
 */
export function processProvisioningData(data: unknown): MaximoItemMaster[] {
  const parts = Array.isArray(data) ? data : (data as { parts?: S2000MPart[] })?.parts ?? [];
  const items: MaximoItemMaster[] = [];

  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i];
    const part: S2000MPart = {
      partNumber: String(raw?.partNumber ?? ''),
      description: String(raw?.description ?? ''),
      unitOfMeasure: String(raw?.unitOfMeasure ?? ''),
    };
    const item = mapPartToMaximoItem(part);
    items.push(item);
    logger.info(
      `S2000M item processed [${i + 1}]: itemnum=${item.itemnum}, description=${item.description}, orderunit=${item.orderunit}`
    );
  }

  return items;
}
