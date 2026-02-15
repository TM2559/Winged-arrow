import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getSearchResults } from './searchController';

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
    const searchQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const [
      manuals,
      spareParts,
      maintenanceTasks,
      feedbackList,
      searchResults,
      manualCount,
      partCount,
      feedbackCount,
    ] = await Promise.all([
      prisma.dataModule.findMany({ orderBy: { dmCode: 'asc' } }),
      prisma.sparePart.findMany({ orderBy: { partNumber: 'asc' } }),
      prisma.maintenanceTask.findMany({
        orderBy: { taskCode: 'asc' },
        include: { dm: true, part: true },
      }),
      prisma.feedback.findMany({ orderBy: { createdAt: 'desc' } }),
      searchQuery ? getSearchResults(searchQuery) : Promise.resolve([]),
      prisma.dataModule.count(),
      prisma.sparePart.count(),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
    ]);

    logger.info(`Dashboard: ${manuals.length} manuals, ${spareParts.length} spare parts, ${maintenanceTasks.length} maintenance tasks, ${feedbackList.length} feedback`);

    const manualsRows = manuals
      .map(
        (m) =>
          `<tr>
            <td><code>${escapeHtml(m.dmCode)}</code></td>
            <td>${escapeHtml(m.techName ?? '—')}</td>
            <td>${escapeHtml(m.issueDate ?? '—')}</td>
            <td><button type="button" class="btn-qr" data-dmc="${escapeHtml(m.dmCode).replace(/"/g, '&quot;')}" title="Show QR code" aria-label="Show QR code for ${escapeHtml(m.dmCode)}">QR</button></td>
            <td><a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(m.dmCode)}">Open Viewer</a></td>
          </tr>`
      )
      .join('') || '<tr><td colspan="5" class="empty">No data modules yet. Upload S1000D XML via <code>POST /api/s1000d/upload</code>.</td></tr>';

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

    const manualsCardsHtml =
      manuals.length > 0
        ? manuals
            .map(
              (m) =>
                `<article class="mobile-card">
                  <div class="mobile-card-main">
                    <strong class="mobile-card-title">${escapeHtml(m.techName ?? m.dmCode)}</strong>
                    <p class="mobile-card-meta"><code>${escapeHtml(m.dmCode)}</code>${m.issueDate ? ` · ${escapeHtml(m.issueDate)}` : ''}</p>
                  </div>
                  <div class="mobile-card-actions">
                    <button type="button" class="btn-qr" data-dmc="${escapeHtml(m.dmCode).replace(/"/g, '&quot;')}" aria-label="QR for ${escapeHtml(m.dmCode)}">QR</button>
                    <a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(m.dmCode)}">Open manual</a>
                  </div>
                </article>`
            )
            .join('')
        : '<p class="empty">No data modules yet.</p>';

    const partsCardsHtml =
      spareParts.length > 0
        ? spareParts
            .map(
              (p) =>
                `<article class="mobile-card">
                  <div class="mobile-card-main">
                    <strong class="mobile-card-title">${escapeHtml(p.name)}</strong>
                    <p class="mobile-card-meta"><code>${escapeHtml(p.partNumber)}</code> · ${p.quantity} ${escapeHtml(p.unit ?? '')}</p>
                  </div>
                </article>`
            )
            .join('')
        : '<p class="empty">No spare parts yet.</p>';

    const tasksCardsHtml =
      maintenanceTasks.length > 0
        ? maintenanceTasks
            .map(
              (t) => {
                const manualBtn = t.dm
                  ? `<a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(t.dm.dmCode)}">View manual</a>`
                  : '<span class="mobile-card-muted">—</span>';
                const partText = t.part ? `${escapeHtml(t.part.partNumber)} – ${escapeHtml(t.part.name)}` : '—';
                return `<article class="mobile-card">
                  <div class="mobile-card-main">
                    <strong class="mobile-card-title">${escapeHtml(t.description)}</strong>
                    <p class="mobile-card-meta"><code>${escapeHtml(t.taskCode)}</code> · ${escapeHtml(t.interval)}</p>
                    ${t.part ? `<p class="mobile-card-meta mobile-card-part">Part: ${partText}</p>` : ''}
                  </div>
                  <div class="mobile-card-actions">${manualBtn}</div>
                </article>`;
              }
            )
            .join('')
        : '<p class="empty">No maintenance tasks yet.</p>';

    const feedbackItems =
      feedbackList.length > 0
        ? feedbackList
            .map(
              (f) => {
                const reported = new Date(f.createdAt).toLocaleString();
                const resolveBtn =
                  f.status === 'OPEN'
                    ? `<form method="get" action="/api/feedback/${f.id}/resolve" style="display:inline;"><button type="submit" class="btn btn-resolve">Resolve</button></form>`
                    : '<span class="status-resolved">Resolved</span>';
                return `<li class="feedback-item"><strong>Manual <code>${escapeHtml(f.dmCode)}</code></strong> has an issue: ${escapeHtml(f.message)} <span class="feedback-meta">(Reported: ${escapeHtml(reported)})</span> ${resolveBtn}</li>`;
              }
            )
            .join('')
        : '<li class="empty">No technician feedback yet. Use "Report Issue" in the Viewer to submit.</li>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAXIMO Mobile Gateway | Škoda Transportation</title>
  <meta property="og:title" content="MAXIMO Mobile Gateway | Škoda Transportation">
  <meta name="twitter:title" content="MAXIMO Mobile Gateway | Škoda Transportation">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Roboto', system-ui, sans-serif;
      margin: 0;
      padding: 0;
      color: #212121;
      line-height: 1.5;
      background: #eaeff2;
    }
    .header {
      background: #002855;
      color: #fff;
      padding: 1.25rem 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .header h1 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .header p {
      margin: 0.25rem 0 0;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 2rem 2rem;
    }
    .card {
      background: #ffffff;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 1.5rem;
      overflow: hidden;
      border: 1px solid #dde1e4;
    }
    .card h2 {
      margin: 0;
      padding: 0.75rem 1.25rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: #212121;
      border-bottom: 1px solid #dde1e4;
      background: #f5f7f8;
    }
    .card table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .card th {
      text-align: left;
      padding: 0.5rem 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #212121;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #dde1e4;
      background: #f5f7f8;
    }
    .card td {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #eaeff2;
    }
    .card tr:last-child td { border-bottom: none; }
    .card tr:hover td { background: #f8f9fa; }
    .card code {
      font-size: 0.8rem;
      background: #eaeff2;
      padding: 0.15em 0.35em;
      border-radius: 2px;
      border: 1px solid #dde1e4;
    }
    .empty { color: #666; font-style: italic; }
    .btn {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 500;
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.15s, color 0.15s;
    }
    .btn-viewer {
      background: #009fe3;
      color: #fff;
    }
    .btn-viewer:hover {
      background: #0082c0;
      color: #fff;
    }
    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .table-wrap table {
      min-width: 0;
    }
    .th-short { display: none; }
    .cards-mobile { display: none; }
    .mobile-card {
      background: #fff;
      border-radius: 8px;
      border: 1px solid #eaeff2;
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .mobile-card:last-child { margin-bottom: 0; }
    .mobile-card-main { margin-bottom: 0.75rem; }
    .mobile-card-main:last-child { margin-bottom: 0; }
    .mobile-card-title { font-size: 1rem; font-weight: 600; color: #212121; display: block; margin-bottom: 0.25rem; }
    .mobile-card-meta { font-size: 0.85rem; color: #666; margin: 0; }
    .mobile-card-part { margin-top: 0.25rem; }
    .mobile-card-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .mobile-card-actions .btn-viewer { flex: 1; min-width: 140px; text-align: center; }
    .mobile-card-muted { font-size: 0.9rem; color: #999; }
    .btn-qr {
      min-width: 36px;
      padding: 0.35rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #002855;
      background: #fff;
      border: 1px solid #009fe3;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-qr:hover {
      background: #e8f6fc;
      border-color: #002855;
    }
    .maximo-demo {
      margin: 0 0 1.5rem;
    }
    .btn-maximo {
      background: #002855;
      color: #fff;
    }
    .btn-maximo:hover {
      background: #001d42;
      color: #fff;
    }
    .feedback-list {
      list-style: none;
      padding: 0 1.25rem 1rem;
      margin: 0;
    }
    .feedback-item {
      padding: 0.6rem 0;
      border-bottom: 1px solid #eaeff2;
    }
    .feedback-item:last-child { border-bottom: none; }
    .feedback-meta {
      font-size: 0.8rem;
      color: #666;
    }
    .btn-resolve {
      background: #009fe3;
      color: #fff;
      border: none;
      cursor: pointer;
      margin-left: 0.5rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 4px;
    }
    .btn-resolve:hover {
      background: #0082c0;
      color: #fff;
    }
    .status-resolved {
      font-size: 0.8rem;
      color: #2e7d32;
      margin-left: 0.5rem;
    }
    .search-wrap {
      max-width: 640px;
      margin: -1rem auto 1.5rem;
      padding: 0 2rem;
    }
    .search-form {
      display: flex;
      align-items: center;
      background: #ffffff;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #dde1e4;
      overflow: hidden;
    }
    .search-form:focus-within {
      box-shadow: 0 0 0 2px #009fe3;
      border-color: #009fe3;
    }
    .search-icon {
      padding: 0 1rem;
      color: #666;
      font-size: 1.1rem;
      pointer-events: none;
    }
    .search-input {
      flex: 1;
      min-width: 0;
      padding: 0.75rem 0.75rem 0.75rem 0;
      font-size: 1rem;
      border: none;
      outline: none;
      font-family: inherit;
    }
    .search-input::placeholder {
      color: #999;
    }
    .search-submit {
      padding: 0.6rem 1rem;
      margin: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #fff;
      background: #009fe3;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .search-submit:hover {
      background: #0082c0;
    }
    .search-results-card {
      background: #ffffff;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 1.5rem;
      overflow: hidden;
      border: 1px solid #dde1e4;
    }
    .search-results-card h2 {
      margin: 0;
      padding: 0.75rem 1.25rem;
      font-size: 1.05rem;
      font-weight: 600;
      color: #212121;
      border-bottom: 1px solid #dde1e4;
      background: #e8f4fa;
    }
    .search-results-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .search-results-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      border-bottom: 1px solid #eaeff2;
    }
    .search-results-list li:last-child { border-bottom: none; }
    .search-results-list li:hover { background: #f8f9fa; }
    .search-results-list .manual-title {
      font-weight: 500;
      color: #212121;
    }
    .search-results-list .manual-dmc {
      font-size: 0.85rem;
      color: #666;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      max-width: 960px;
      margin: 0 auto 1.5rem;
      padding: 0 2rem;
    }
    .stat-card {
      background: #ffffff;
      border-radius: 4px;
      padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border: 1px solid #dde1e4;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .stat-card-icon {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      flex-shrink: 0;
    }
    .stat-card.primary .stat-card-icon { background: #e8f4fa; color: #002855; }
    .stat-card.success .stat-card-icon { background: #e0f2ed; color: #009fe3; }
    .stat-card.danger .stat-card-icon { background: #ffebee; color: #c62828; }
    .stat-card-body { min-width: 0; }
    .stat-card-value {
      font-size: 1.5rem;
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 0.15rem;
    }
    .stat-card.primary .stat-card-value { color: #002855; }
    .stat-card.success .stat-card-value { color: #009fe3; }
    .stat-card.danger .stat-card-value { color: #c62828; }
    .stat-card-label {
      font-size: 0.8rem;
      color: #666;
      margin: 0;
    }
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,40,85,0.4);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.open {
      display: flex;
    }
    .modal-box {
      background: #ffffff;
      padding: 1.5rem;
      border-radius: 4px;
      max-width: 320px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      border: 1px solid #dde1e4;
    }
    .modal-box h3 {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
      color: #212121;
    }
    .modal-box .qr-canvas-wrap {
      display: flex;
      justify-content: center;
      margin: 1rem 0;
    }
    .modal-box .qr-canvas-wrap canvas {
      display: block;
    }
    .modal-box .qr-url {
      font-size: 0.75rem;
      color: #666;
      word-break: break-all;
      margin-top: 0.75rem;
    }
    .modal-close {
      display: block;
      width: 100%;
      margin-top: 1rem;
      padding: 0.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      color: #002855;
      background: #eaeff2;
      border: 1px solid #dde1e4;
      border-radius: 4px;
      cursor: pointer;
    }
    .modal-close:hover {
      background: #dde1e4;
    }
    @media (max-width: 640px) {
      .stats-row { grid-template-columns: 1fr; padding: 0 1rem; }
      .container { padding: 0 1rem 2rem; }
      .card .table-wrap { display: none; }
      .cards-mobile { display: block; padding: 0 1.25rem 1.25rem; }
      .th-manual .th-full { display: none; }
      .th-manual .th-short { display: inline; }
      .btn-viewer, .btn-qr {
        min-height: 44px;
        padding: 0.6rem 1rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>MAXIMO Gateway</h1>
    <p>Welcome to MAXIMO Mobile Gateway. Integrated Maintenance Interface for Škoda Assets.</p>
  </header>
  <div class="stats-row">
    <div class="stat-card primary">
      <div class="stat-card-icon" aria-hidden="true">📘</div>
      <div class="stat-card-body">
        <p class="stat-card-value">${manualCount}</p>
        <p class="stat-card-label">Active Manuals</p>
      </div>
    </div>
    <div class="stat-card success">
      <div class="stat-card-icon" aria-hidden="true">⚙️</div>
      <div class="stat-card-body">
        <p class="stat-card-value">${partCount}</p>
        <p class="stat-card-label">Spare Parts Indexed</p>
      </div>
    </div>
    <div class="stat-card danger">
      <div class="stat-card-icon" aria-hidden="true">⚠️</div>
      <div class="stat-card-body">
        <p class="stat-card-value">${feedbackCount}</p>
        <p class="stat-card-label">Technician Reports</p>
      </div>
    </div>
  </div>
  <div class="search-wrap">
    <form class="search-form" action="/" method="get" role="search">
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" name="q" class="search-input" placeholder="Search manuals (e.g. brzda, šroub)…" value="${escapeHtml(searchQuery)}" autocomplete="off" aria-label="Search manuals">
      <button type="submit" class="search-submit">Search</button>
    </form>
  </div>
  <div class="container">
    ${searchQuery ? `
    <section class="search-results-card">
      <h2>Search Results for ‘${escapeHtml(searchQuery)}’</h2>
      ${searchResults.length > 0
        ? `<ul class="search-results-list">
            ${searchResults
              .map(
                (m) =>
                  `<li>
                    <span>
                      <span class="manual-title">${escapeHtml(m.techName ?? m.dmCode)}</span>
                      <span class="manual-dmc"> — <code>${escapeHtml(m.dmCode)}</code></span>
                    </span>
                    <a class="btn btn-viewer" href="/viewer?dmc=${encodeURIComponent(m.dmCode)}">Open Viewer</a>
                  </li>`
              )
              .join('')}
          </ul>`
        : '<p class="empty" style="padding: 1rem 1.25rem; margin: 0;">No manuals match this search.</p>'}
    </section>
    ` : ''}
    <p class="maximo-demo"><a href="/maximo-mock" class="btn btn-maximo">🚀 Run Maximo Demo Simulation</a></p>
    <section class="card">
      <h2>Active Manuals (S1000D)</h2>
      <div class="table-wrap" role="region" aria-label="Manuals table - scroll horizontally on small screens">
        <table>
        <thead>
          <tr>
            <th>DMC</th>
            <th>Technical Name</th>
            <th>Issue Date</th>
            <th>QR</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          ${manualsRows}
        </tbody>
      </table>
      </div>
      <div class="cards-mobile" aria-label="Manuals list">${manualsCardsHtml}</div>
    </section>
    <section class="card">
      <h2>Spare Parts Inventory (S2000M)</h2>
      <div class="table-wrap">
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
      </div>
      <div class="cards-mobile" aria-label="Spare parts list">${partsCardsHtml}</div>
    </section>
    <section class="card">
      <h2>Maintenance Schedule (S3000L)</h2>
      <p style="margin: 0 1.25rem 0.75rem; font-size: 0.9rem; color: #555;">Task (S3000L) → defines Method (S1000D) → uses Material (S2000M).</p>
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task Code</th>
            <th>Description</th>
            <th>Interval</th>
            <th class="th-manual"><span class="th-full">Linked Manual</span><span class="th-short">Manual</span></th>
            <th>Required Part</th>
          </tr>
        </thead>
        <tbody>
          ${tasksRows}
        </tbody>
      </table>
      </div>
      <div class="cards-mobile" aria-label="Maintenance tasks list">${tasksCardsHtml}</div>
    </section>
    <section class="card">
      <h2>Quality Assurance / Technician Feedback</h2>
      <p style="margin: 0 1.25rem 0.75rem; font-size: 0.9rem; color: #555;">Field reports from technicians viewing manuals. Resolve when addressed.</p>
      <ul class="feedback-list">
        ${feedbackItems}
      </ul>
    </section>
  </div>
  <div class="modal-overlay" id="qr-modal" role="dialog" aria-labelledby="qr-modal-title" aria-modal="true">
    <div class="modal-box">
      <h3 id="qr-modal-title">QR Code – Viewer link</h3>
      <div class="qr-canvas-wrap"><canvas id="qr-canvas"></canvas></div>
      <p class="qr-url" id="qr-url"></p>
      <button type="button" class="modal-close" id="qr-modal-close">Close</button>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script>
  <script>
    (function() {
      var overlay = document.getElementById('qr-modal');
      var canvasEl = document.getElementById('qr-canvas');
      var urlEl = document.getElementById('qr-url');
      var closeBtn = document.getElementById('qr-modal-close');
      function openQr(dmc) {
        var origin = window.location.origin;
        var url = origin + '/viewer/' + encodeURIComponent(dmc);
        urlEl.textContent = url;
        canvasEl.width = 200;
        canvasEl.height = 200;
        var qr = new QRious({ element: canvasEl, value: url, size: 200 });
        overlay.classList.add('open');
      }
      function closeQr() {
        overlay.classList.remove('open');
      }
      document.querySelectorAll('.btn-qr').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var dmc = btn.getAttribute('data-dmc');
          if (dmc) openQr(dmc);
        });
      });
      closeBtn.addEventListener('click', closeQr);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeQr();
      });
    })();
  </script>
  <footer style="font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 1px; color: #666; padding: 20px; text-transform: uppercase; text-align: center; margin-top: 40px;">
    A.9FF <span style="color: #999;">//</span> 0x9ff.dev <span style="color: #999;">//</span> LOC: 10CC1
  </footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.error('Dashboard error', err);
    res.status(500).send('Internal server error');
  }
}
