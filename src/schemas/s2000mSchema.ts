import { z } from 'zod';

const S2000M_UNITS = ['KS', 'SET', 'M', 'KG'] as const;

/** Single S2000M part for import validation */
export const s2000mPartSchema = z.object({
  partNumber: z.string().min(3, 'partNumber must be at least 3 characters'),
  description: z.string().max(100, 'description must be at most 100 characters'),
  unitOfMeasure: z.enum(S2000M_UNITS, {
    message: `unitOfMeasure must be one of: ${S2000M_UNITS.join(', ')}`,
  }),
});

/** Request body for S2000M part import (object with parts array) */
export const s2000mImportBodySchema = z.object({
  parts: z.array(s2000mPartSchema).min(1, 'At least one part is required'),
});

export type S2000MPartInput = z.infer<typeof s2000mPartSchema>;
export type S2000MImportBody = z.infer<typeof s2000mImportBodySchema>;
