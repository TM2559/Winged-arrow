import { z } from 'zod';

const stringOrFirst = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Query params for GET /link - work order required, serial number optional */
export const s1000dLinkQuerySchema = z.object({
  wo: z.preprocess(
    stringOrFirst,
    z.string().trim().min(1, 'Query parameter "wo" (work order) is required')
  ),
  sn: z.preprocess(stringOrFirst, z.string().trim().optional()),
});

export type S1000DLinkQuery = z.infer<typeof s1000dLinkQuerySchema>;
