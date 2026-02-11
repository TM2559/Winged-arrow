import { Router } from 'express';
import { getLinkForWorkOrder } from '../controllers/s1000dController';

const router = Router();

router.get('/link', getLinkForWorkOrder);

export default router;
