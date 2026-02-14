import { Router } from 'express';
import * as s3000lController from '../controllers/s3000lController';

const router = Router();

/**
 * @openapi
 * /api/s3000l/seed:
 *   get:
 *     summary: Seed S3000L maintenance task (simulate import)
 *     description: Creates or updates a sample maintenance task (Brake Inspection) and links it to the Data Module with DMC "SKODA-A-32-40-00-00-00-A-040-A-A" when available. Returns JSON success.
 *     tags:
 *       - S3000L
 *     responses:
 *       200:
 *         description: Task seeded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 task: { type: object }
 *       500:
 *         description: Seed failed
 */
router.get('/seed', s3000lController.seed);
router.post('/seed', s3000lController.seed);

export default router;
