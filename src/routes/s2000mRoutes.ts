import { Router } from 'express';
import { importProvisioningData } from '../controllers/s2000mController';
import { validateBody } from '../middleware/validateRequest';
import { s2000mImportBodySchema } from '../schemas/s2000mSchema';

const router = Router();

/**
 * @openapi
 * /api/v1/s2000m/import:
 *   post:
 *     summary: Import S2000M provisioning data
 *     description: Accepts S2000M provisioning data (parts array), maps to Maximo Item Master, and simulates sending the payload to Maximo (logs only for now).
 *     tags:
 *       - S2000M
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/S2000MImportBody'
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

router.post('/import', validateBody(s2000mImportBodySchema), importProvisioningData);

export default router;
