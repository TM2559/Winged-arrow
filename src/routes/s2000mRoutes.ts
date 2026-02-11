import { Router } from 'express';
import { importProvisioningData } from '../controllers/s2000mController';

const router = Router();

router.post('/import', importProvisioningData);

export default router;
