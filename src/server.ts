import 'dotenv/config';
import path from 'path';
import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { specs } from './swagger';
import s1000dRoutes from './routes/s1000dRoutes';
import s2000mRoutes from './routes/s2000mRoutes';
import s3000lRouter from './routes/s3000lRoutes';
import feedbackRouter from './routes/feedbackRoutes';
import { getViewerByDmc, getViewerByDmCode } from './controllers/viewerController';
import { getDashboard } from './controllers/dashboardController';
import { getMaximoMock } from './controllers/maximoMockController';

const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(express.json());
app.use(express.text({ type: 'application/xml' }));

// ---------------------------------------------------------------------------
// Swagger API documentation (after express.json, before app.listen)
// ---------------------------------------------------------------------------
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ---------------------------------------------------------------------------
// Dashboard: GET / – manuals (S1000D) and spare parts (S2000M) with Open Viewer links
// ---------------------------------------------------------------------------
app.get('/', (req, res, next) => {
  getDashboard(req, res).catch(next);
});

// ---------------------------------------------------------------------------
// Maximo Simulation: GET /maximo-mock – Work Order demo with S1000D manual link
// ---------------------------------------------------------------------------
app.get('/maximo-mock', (req, res, next) => {
  getMaximoMock(req, res).catch(next);
});

// ---------------------------------------------------------------------------
// Native viewer: GET /viewer?dmc=... returns styled HTML manual (or 404)
// ---------------------------------------------------------------------------
app.get('/viewer', (req, res, next) => {
  if (req.query.dmc) {
    getViewerByDmc(req, res).catch(next);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Native viewer by path: GET /viewer/:dmCode (HTML page)
// ---------------------------------------------------------------------------
app.get('/viewer/:dmCode', getViewerByDmCode);

// ---------------------------------------------------------------------------
// Mock viewer (static: /viewer, /viewer/index.html, etc.)
// ---------------------------------------------------------------------------
app.use('/viewer', express.static(path.join(__dirname, '../mocks/viewer')));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// S1000D & S2000M API
// ---------------------------------------------------------------------------
app.use('/api/s1000d', s1000dRoutes);
app.use('/api/s2000m', s2000mRoutes);
app.use('/api/s3000l', s3000lRouter);
app.use('/api/feedback', feedbackRouter);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, (): void => {
  logger.info(`Server listening on port ${PORT}`);
});
