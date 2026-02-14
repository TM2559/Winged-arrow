import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const PREFERRED_DMC = 'SKODA-A-32-40-00-00-00-A-040-A-A';
const SAMPLE_TASK_CODE = 'TASK-BRK-INSPECT';
const SAMPLE_DESCRIPTION = 'Brake Inspection';
const SAMPLE_INTERVAL = 'Every 20,000 km';
const SAMPLE_PERSONNEL = 'Mechanic (Level 2)';
const SAMPLE_DURATION = 1.0;

/**
 * GET/POST /api/s3000l/seed
 * Seeds a sample S3000L maintenance task and links it to the existing Data Module (S1000D)
 * with DMC "SKODA-A-32-40-00-00-00-A-040-A-A" when available. Returns JSON success.
 */
export async function seed(req: Request, res: Response): Promise<void> {
  try {
    // Prefer the existing DataModule by exact DMC
    let dm = await prisma.dataModule.findUnique({
      where: { dmCode: PREFERRED_DMC },
    });
    if (!dm) {
      dm = await prisma.dataModule.findFirst({
        where: {
          OR: [
            { techName: { contains: 'Brake' } },
            { dmCode: { contains: 'BRZDA' } },
          ],
        },
      });
    }
    if (!dm) {
      dm = await prisma.dataModule.findFirst({ orderBy: { dmCode: 'asc' } });
    }

    // Find or create a brake-related Spare Part
    let part = await prisma.sparePart.findFirst({
      where: {
        OR: [
          { partNumber: { contains: 'BP-' } },
          { name: { contains: 'Brake' } },
        ],
      },
    });
    if (!part) {
      part = await prisma.sparePart.findFirst({ orderBy: { partNumber: 'asc' } });
    }
    if (!part) {
      part = await prisma.sparePart.create({
        data: {
          partNumber: 'BP-109E-001',
          name: 'Brake Pad, disc brake, front axle',
          quantity: 10,
          unit: 'EA',
        },
      });
      logger.info('S3000L seed: created sample SparePart BP-109E-001');
    }

    const task = await prisma.maintenanceTask.upsert({
      where: { taskCode: SAMPLE_TASK_CODE },
      create: {
        taskCode: SAMPLE_TASK_CODE,
        description: SAMPLE_DESCRIPTION,
        interval: SAMPLE_INTERVAL,
        personnel: SAMPLE_PERSONNEL,
        duration: SAMPLE_DURATION,
        dmId: dm?.id ?? null,
        partId: part?.id ?? null,
      },
      update: {
        description: SAMPLE_DESCRIPTION,
        interval: SAMPLE_INTERVAL,
        personnel: SAMPLE_PERSONNEL,
        duration: SAMPLE_DURATION,
        dmId: dm?.id ?? null,
        partId: part?.id ?? null,
      },
      include: {
        dm: true,
        part: true,
      },
    });

    logger.info(`S3000L seed: task ${task.taskCode} linked to dm=${dm?.dmCode ?? 'none'}, part=${part.partNumber}`);

    res.status(200).json({
      success: true,
      message: 'Maintenance task seeded (S3000L). Task → Method (S1000D) → Material (S2000M).',
      task: {
        id: task.id,
        taskCode: task.taskCode,
        description: task.description,
        interval: task.interval,
        personnel: task.personnel,
        duration: task.duration,
        linkedDmCode: task.dm?.dmCode ?? null,
        linkedPartNumber: task.part?.partNumber ?? null,
      },
    });
  } catch (err) {
    logger.error('S3000L seed error', err);
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : 'Seed failed',
    });
  }
}
