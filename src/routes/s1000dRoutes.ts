import { Router } from 'express';
import multer from 'multer';
import { getLinkForWorkOrder, uploadS1000DXml } from '../controllers/s1000dController';

const router = Router();

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

router.get('/link', getLinkForWorkOrder);
router.post('/upload', upload.any(), uploadS1000DXml);

export default router;
