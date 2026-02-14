import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const DEMO_DMC = 'SKODA-A-32-40-00-00-00-A-040-A-A';

/**
 * GET /maximo-mock
 * Maximo Simulation page: Work Order box and button to open S1000D Viewer for the linked DMC.
 * Uses IBM Maximo colors (header #003a6b).
 */
export async function getMaximoMock(req: Request, res: Response): Promise<void> {
  try {
    const viewerUrl = `/viewer?dmc=${encodeURIComponent(DEMO_DMC)}&from=maximo`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IBM Maximo – Work Order Tracking</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.5;
      background: #e8eaed;
    }
    .header {
      background: #003a6b;
      color: #fff;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .header p {
      margin: 0.35rem 0 0;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 2rem 2rem;
    }
    .back {
      margin-bottom: 1rem;
    }
    .back a {
      color: #003a6b;
      text-decoration: none;
      font-weight: 500;
    }
    .back a:hover {
      text-decoration: underline;
    }
    .wo-card {
      background: #fff;
      border: 1px solid #c5c9ce;
      border-radius: 6px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .wo-card h2 {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
      color: #003a6b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .wo-row {
      display: flex;
      padding: 0.5rem 0;
      border-bottom: 1px solid #eee;
    }
    .wo-row:last-child { border-bottom: none; }
    .wo-label {
      flex: 0 0 120px;
      font-weight: 600;
      color: #555;
      font-size: 0.875rem;
    }
    .wo-value {
      flex: 1;
      font-size: 0.95rem;
    }
    .wo-value code {
      background: #f0f0f0;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .status-inprg {
      display: inline-block;
      background: #e3f2fd;
      color: #1565c0;
      padding: 0.2em 0.6em;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.875rem;
    }
    .btn-manual {
      display: inline-block;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      font-size: 1.1rem;
      font-weight: 600;
      text-align: center;
      text-decoration: none;
      background: #003a6b;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,58,107,0.35);
      transition: background 0.2s, box-shadow 0.2s;
    }
    .btn-manual:hover {
      background: #002a52;
      box-shadow: 0 3px 8px rgba(0,58,107,0.45);
      color: #fff;
    }
    .btn-wrap {
      text-align: center;
      margin-top: 1.5rem;
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>IBM Maximo – Work Order Tracking</h1>
    <p>Simulation: open the linked S1000D technical manual from this work order.</p>
  </header>
  <div class="container">
    <div class="back">
      <a href="/">← Back to Dashboard</a>
    </div>
    <section class="wo-card">
      <h2>Work Order</h2>
      <div class="wo-row">
        <span class="wo-label">WO Number</span>
        <span class="wo-value"><code>WO-987213</code></span>
      </div>
      <div class="wo-row">
        <span class="wo-label">Description</span>
        <span class="wo-value">Brake System Inspection &amp; Maintenance</span>
      </div>
      <div class="wo-row">
        <span class="wo-label">Asset</span>
        <span class="wo-value">Skoda ForCity Smart Tram - Bogie A2</span>
      </div>
      <div class="wo-row">
        <span class="wo-label">Status</span>
        <span class="wo-value"><span class="status-inprg">INPRG</span> (In Progress)</span>
      </div>
    </section>
    <div class="btn-wrap">
      <a class="btn-manual" href="${viewerUrl}" target="_blank" rel="noopener">OPEN TECHNICAL MANUAL (S1000D)</a>
    </div>
  </div>
</body>
</html>`;

    logger.info('Maximo mock page served');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Maximo mock error', err);
    res.status(500).send('Internal server error');
  }
}
