import { z } from 'zod';

/** Single S2000M part for import validation */
export const s2000mPartSchema = z.object({
  partNumber: z.string().min(3, 'partNumber must be at least 3 characters'),
  description: z.string().min(1, 'description is required'),
  unitOfMeasure: z.string().optional().default('PC'),
  quantity: z.number().positive('quantity must be positive').default(1),
});

/** Request body for S2000M part import (object with parts array) */
export const s2000mImportBodySchema = z.object({
  parts: z.array(s2000mPartSchema).min(1, 'At least one part is required'),
});

export type S2000MPartInput = z.infer<typeof s2000mPartSchema>;
export type S2000MImportBody = z.infer<typeof s2000mImportBodySchema>;
