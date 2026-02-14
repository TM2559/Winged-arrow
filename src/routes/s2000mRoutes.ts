import { Router } from 'express';
import { getParts, importProvisioningData } from '../controllers/s2000mController';
import { validateResource } from '../middleware/validateRequest';
import { s2000mImportBodySchema } from '../schemas/s2000mSchema';

const router = Router();

router.get('/', getParts);

/**
 * @openapi
 * /api/v1/s2000m/import:
 *   post:
 *     summary: Import S2000M provisioning data
 *     description: |
 *       Accepts a JSON body with a root property `parts`: an array of part objects.
 *       Each part must have `partNumber` (string, min 3 chars) and `description` (string).
 *       Optional: `unitOfMeasure` (string, default "PC"), `quantity` (positive number, default 1).
 *       At least one part is required. Validated by Zod (s2000mImportBodySchema).
 *     tags:
 *       - S2000M
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/S2000MImportBody'
 *           example:
 *             parts:
 *               - partNumber: "SKD-123"
 *                 description: "Test Part"
 *                 quantity: 5
 *     responses:
 *       200:
 *         description: Import successful (payload logged; Maximo API integration pending)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 imported:
 *                   type: integer
 *                   description: Number of items imported
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing body, validation failed, or no parts to import
 */

router.post('/import', validateResource(s2000mImportBodySchema), importProvisioningData);

export default router;
