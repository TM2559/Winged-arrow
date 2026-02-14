import { Router } from 'express';
import { createFeedback, getFeedback, resolveFeedback } from '../controllers/feedbackController';

const router = Router();

router.post('/', createFeedback);
router.get('/', getFeedback);
router.get('/:id/resolve', resolveFeedback);

export default router;
