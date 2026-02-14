import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * POST /api/feedback
 * Create technician feedback: save dmCode and message to DB (status default OPEN).
 */
export async function createFeedback(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as { dmCode?: string; message?: string };
    const dmCode = typeof body.dmCode === 'string' ? body.dmCode.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!dmCode || !message) {
      res.status(400).json({ error: 'dmCode and message are required' });
      return;
    }

    const feedback = await prisma.feedback.create({
      data: {
        dmCode,
        message,
        status: 'OPEN',
      },
    });

    logger.info('Feedback created', { id: feedback.id, dmCode: feedback.dmCode });
    res.status(201).json({
      id: feedback.id,
      dmCode: feedback.dmCode,
      message: feedback.message,
      status: feedback.status,
      createdAt: feedback.createdAt,
    });
  } catch (err) {
    logger.error('createFeedback error', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
}

/**
 * GET /api/feedback
 * Return all feedback items (newest first).
 */
export async function getFeedback(req: Request, res: Response): Promise<void> {
  try {
    const items = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ feedback: items });
  } catch (err) {
    logger.error('getFeedback error', err);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
}

/**
 * GET /api/feedback/:id/resolve
 * (Mock) Update feedback status to RESOLVED and redirect to dashboard.
 * Used from dashboard "Resolve" link for simple UX.
 */
export async function resolveFeedback(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid feedback id' });
      return;
    }

    await prisma.feedback.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });

    logger.info('Feedback resolved', { id });
    res.redirect(302, '/');
  } catch (err) {
    logger.error('resolveFeedback error', err);
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
}
