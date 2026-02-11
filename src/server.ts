import 'dotenv/config';
import path from 'path';
import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { specs } from './swagger';
import s1000dRoutes from './routes/s1000dRoutes';
import s2000mRoutes from './routes/s2000mRoutes';

const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(express.json());

// ---------------------------------------------------------------------------
// Swagger API documentation (after express.json, before app.listen)
// ---------------------------------------------------------------------------
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ---------------------------------------------------------------------------
// Mock viewer (static)
// ---------------------------------------------------------------------------
app.use('/viewer', express.static(path.join(__dirname, '../mocks/viewer')));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// S1000D API
// ---------------------------------------------------------------------------
app.use('/api/v1/s1000d', s1000dRoutes);
app.use('/api/v1/s2000m', s2000mRoutes);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, (): void => {
  logger.info(`Server listening on port ${PORT}`);
});
