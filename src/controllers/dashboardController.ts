import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * GET /
 * Dashboard: lists Available Manuals (S1000D) and Spare Parts Inventory (S2000M).
 * Each manual has an "Open Viewer" link to /viewer?dmc=...
 */
export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const [manuals, spareParts, maintenanceTasks] = await Promise.all([
      prisma.dataModule.findMany({ orderBy: { dmCode: 'asc' } }),
      prisma.sparePart.findMany({ orderBy: { partNumber: 'asc' } }),
      prisma.maintenanceTask.findMany({
        orderBy: { taskCode: 'asc' },
        include: { dm: true, part: true },
      }),
    ]);

    logger.info(`Dashboard: ${manuals.length} manuals, ${spareParts.length} spare parts, ${maintenanceTasks.length} maintenance tasks`);

    const manualsRows = manuals
      .map(
        (m) =>
          `<tr>
            <td><code>${escapeHtml(m.dmCode)}</code></td>
            <td>${escapeHtml(m.techName ?? '—')}</td>
            <td>${escapeHtml(m.issueDate ?? '—')}</td>
            <td><a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(m.dmCode)}">Open Viewer</a></td>
          </tr>`
      )
      .join('') || '<tr><td colspan="4" class="empty">No data modules yet. Upload S1000D XML via <code>POST /api/s1000d/upload</code>.</td></tr>';

    const partsRows = spareParts
      .map(
        (p) =>
          `<tr>
            <td><code>${escapeHtml(p.partNumber)}</code></td>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.quantity}</td>
            <td>${escapeHtml(p.unit ?? '—')}</td>
          </tr>`
      )
      .join('') || '<tr><td colspan="4" class="empty">No spare parts yet. Import via <code>POST /api/s2000m/import</code>.</td></tr>';

    const tasksRows = maintenanceTasks
      .map(
        (t) => {
          const linkedManual = t.dm
            ? `<a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(t.dm.dmCode)}">View Manual</a>`
            : '—';
          const requiredPart = t.part
            ? `<code>${escapeHtml(t.part.partNumber)}</code> – ${escapeHtml(t.part.name)}`
            : '—';
          return `<tr>
            <td><code>${escapeHtml(t.taskCode)}</code></td>
            <td>${escapeHtml(t.description)}</td>
            <td>${escapeHtml(t.interval)}</td>
            <td>${linkedManual}</td>
            <td>${requiredPart}</td>
          </tr>`;
        }
      )
      .join('') || '<tr><td colspan="5" class="empty">No maintenance tasks yet. Seed via <a href="/api/s3000l/seed">GET /api/s3000l/seed</a>.</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Portal – Škoda IPS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      line-height: 1.5;
      background: #f0f2f5;
    }
    .header {
      background: #4ba82e;
      color: #fff;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
    }
    .header p {
      margin: 0.35rem 0 0;
      font-size: 0.95rem;
      opacity: 0.95;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 2rem 2rem;
    }
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      margin-bottom: 2rem;
      overflow: hidden;
    }
    .card h2 {
      margin: 0;
      padding: 1rem 1.25rem;
      font-size: 1.15rem;
      font-weight: 600;
      color: #333;
      border-bottom: 1px solid #e8e8e8;
      background: #fafafa;
    }
    .card table {
      width: 100%;
      border-collapse: collapse;
    }
    .card th {
      text-align: left;
      padding: 0.75rem 1.25rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-bottom: 1px solid #e8e8e8;
    }
    .card td {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #f0f0f0;
    }
    .card tr:last-child td { border-bottom: none; }
    .card tr:hover td { background: #fafafa; }
    .card code {
      font-size: 0.875rem;
      background: #f0f0f0;
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }
    .empty { color: #666; font-style: italic; }
    .btn {
      display: inline-block;
      padding: 0.4rem 0.9rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      border-radius: 6px;
      transition: background 0.15s, color 0.15s;
    }
    .btn-viewer {
      background: #4ba82e;
      color: #fff;
    }
    .btn-viewer:hover {
      background: #3d8f26;
      color: #fff;
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>Documentation Portal</h1>
    <p>Škoda IPS – S1000D Manuals, S2000M Spare Parts &amp; S3000L Maintenance Schedule</p>
  </header>
  <div class="container">
    <section class="card">
      <h2>Available Manuals (S1000D)</h2>
      <table>
        <thead>
          <tr>
            <th>DMC</th>
            <th>Technical Name</th>
            <th>Issue Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${manualsRows}
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>Spare Parts Inventory (S2000M)</h2>
      <table>
        <thead>
          <tr>
            <th>Part Number</th>
            <th>Name</th>
            <th>Quantity</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          ${partsRows}
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>Maintenance Schedule (S3000L)</h2>
      <p style="margin: 0 1.25rem 0.75rem; font-size: 0.9rem; color: #555;">Task (S3000L) → defines Method (S1000D) → uses Material (S2000M).</p>
      <table>
        <thead>
          <tr>
            <th>Task Code</th>
            <th>Description</th>
            <th>Interval</th>
            <th>Linked Manual</th>
            <th>Required Part</th>
          </tr>
        </thead>
        <tbody>
          ${tasksRows}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Dashboard error', err);
    res.status(500).send('Internal server error');
  }
}
