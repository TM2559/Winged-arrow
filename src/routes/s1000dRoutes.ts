import { Router } from 'express';
import multer from 'multer';
import { getLinkForWorkOrder, uploadS1000DXml } from '../controllers/s1000dController';
import { validateQuery } from '../middleware/validateRequest';
import { s1000dLinkQuerySchema } from '../schemas/s1000dSchema';

const router = Router();

/**
 * @openapi
 * /api/v1/s1000d/link:
 *   get:
 *     summary: Get S1000D viewer link for work order
 *     description: Returns S1000D viewer link data for the given Work Order. If serialNumber (sn) is provided, it is appended to the viewer URL for applicability.
 *     tags:
 *       - S1000D
 *     parameters:
 *       - in: query
 *         name: wo
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order number
 *       - in: query
 *         name: sn
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional serial number for applicability
 *     responses:
 *       200:
 *         description: S1000D viewer link data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workOrder:
 *                   type: string
 *                 asset:
 *                   type: string
 *                 dmc:
 *                   type: string
 *                 viewerUrl:
 *                   type: string
 *                 serialNumber:
 *                   type: string
 *                   description: Present when sn query param was provided
 *       400:
 *         description: Missing required query parameter wo
 *       404:
 *         description: Work order not found
 */

/**
 * @openapi
 * /api/v1/s1000d/upload:
 *   post:
 *     summary: Upload S1000D XML
 *     description: Accepts an S1000D XML file (multipart/form-data). Returns the generated Navigator (viewer) URL based on the DMC found in the XML.
 *     tags:
 *       - S1000D
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               xml:
 *                 type: string
 *                 format: binary
 *                 description: S1000D XML file (field name "xml" or "file")
 *     responses:
 *       200:
 *         description: Parsed DMC and viewer URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dmc:
 *                   type: string
 *                 title:
 *                   type: string
 *                 model:
 *                   type: string
 *                 viewerUrl:
 *                   type: string
 *       400:
 *         description: No file uploaded or invalid S1000D XML
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/xml' ||
      file.mimetype === 'text/xml' ||
      file.originalname.toLowerCase().endsWith('.xml');
    cb(null, !!ok);
  },
});

router.get('/link', validateQuery(s1000dLinkQuerySchema), getLinkForWorkOrder);
router.post('/upload', upload.any(), uploadS1000DXml);

export default router;
