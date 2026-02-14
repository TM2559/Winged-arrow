import { Request, Response } from 'express';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { extractFigureContent } from '../utils/s1000dParser';

/** Parsed viewer content from S1000D XML (title, subtitle, steps as HTML, warnings, cautions, inline figure). */
interface ViewerContent {
  title: string;
  subtitle: string;
  stepsHtml: string[];
  warnings: string[];
  cautions: string[];
  /** Raw <figure> inner content (e.g. <svg>...) from XML when not in illustrationSvg. */
  figureHtml: string | null;
}

/**
 * Parses S1000D xmlContent and extracts title (techName), subtitle (infoName), and steps (proceduralStep > para).
 */
function parseViewerContent(xmlContent: string): ViewerContent {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  const result = parser.parse(xmlContent) as Record<string, unknown> | undefined;
  const dmodule = result?.dmodule as Record<string, unknown> | undefined;

  let title = '';
  let subtitle = '';

  if (dmodule && typeof dmodule === 'object') {
    const dmTitle = findPath(dmodule, [
      'identAndStatusSection',
      'dmAddress',
      'dmAddressItems',
      'dmTitle',
    ]) as Record<string, unknown> | undefined;
    if (dmTitle) {
      if (typeof dmTitle.techName === 'string') title = dmTitle.techName.trim();
      if (typeof dmTitle.infoName === 'string') subtitle = dmTitle.infoName.trim();
    }
    if (!title) {
      const ident = findPath(dmodule, ['identAndStatusSection', 'dmAddress', 'dmIdent']) as Record<string, unknown> | undefined;
      if (ident && typeof ident.techName === 'string') title = ident.techName.trim();
    }
  }

  const stepsHtml = collectProceduralStepsHtml(dmodule);
  const warnings = collectTextFromTag(dmodule, 'warning');
  const cautions = collectTextFromTag(dmodule, 'caution');
  // Extract raw <figure> content so inline SVG is output as-is (ids preserved for interaction)
  const figureHtml = extractFigureContent(xmlContent);

  return {
    title: title || 'S1000D Data Module',
    subtitle,
    stepsHtml,
    warnings,
    cautions,
    figureHtml,
  };
}

function findPath(root: Record<string, unknown> | undefined, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Step node key used by S1000D (procedureSteps) */
const STEP_KEYS = ['proceduralStep', 'procedureStep'] as const;

/** Recursively find all proceduralStep/procedureStep nodes and extract para as HTML (with internalRef → span). */
function collectProceduralStepsHtml(node: unknown): string[] {
  const steps: string[] = [];
  if (node == null) return steps;

  if (typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    for (const key of STEP_KEYS) {
      if (obj[key] !== undefined) {
        const stepNodes = Array.isArray(obj[key]) ? (obj[key] as unknown[]) : [obj[key]];
        for (const step of stepNodes) {
          const html = extractParaHtml(step);
          if (html) steps.push(html);
        }
      }
    }
    for (const key of Object.keys(obj)) {
      if (STEP_KEYS.includes(key as (typeof STEP_KEYS)[number])) continue;
      steps.push(...collectProceduralStepsHtml(obj[key]));
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      steps.push(...collectProceduralStepsHtml(item));
    }
  }
  return steps;
}

/** Extract para content as HTML; internalRef becomes <span class="internal-ref" data-internal-ref-id="...">...</span>. */
function extractParaHtml(stepNode: unknown): string {
  if (stepNode == null) return '';
  if (typeof stepNode === 'string') return escapeHtml(stepNode.trim());
  if (typeof stepNode !== 'object') return '';
  const obj = stepNode as Record<string, unknown>;
  const para = obj.para;
  if (typeof para === 'string') return escapeHtml(para.trim());
  if (Array.isArray(para)) {
    return para.map((p) => extractParaSegmentHtml(p)).join('');
  }
  if (para && typeof para === 'object') return extractParaSegmentHtml(para);
  return '';
}

/** Single para segment (object with #text and/or internalRef; internalRef may be single or array). */
function extractParaSegmentHtml(para: unknown): string {
  if (para == null) return '';
  if (typeof para === 'string') return escapeHtml(para.trim());
  if (typeof para !== 'object') return '';
  const p = para as Record<string, unknown>;
  let fullText = typeof p['#text'] === 'string' ? (p['#text'] as string).trim() : '';
  const ref = p.internalRef;
  if (!ref) return escapeHtml(fullText);
  const refs = Array.isArray(ref) ? ref : [ref];
  if (refs.length === 0) return escapeHtml(fullText);
  let out = escapeHtml(fullText);
  for (const r of refs) {
    if (r == null || typeof r !== 'object') continue;
    const refObj = r as Record<string, unknown>;
    const refId = typeof refObj.internalRefId === 'string' ? refObj.internalRefId.trim() : '';
    const refText = typeof refObj['#text'] === 'string' ? (refObj['#text'] as string).trim() : '';
    const span = `<span class="internal-ref" data-internal-ref-id="${escapeHtml(refId)}">${escapeHtml(refText)}</span>`;
    const escapedRef = escapeHtml(refText);
    const idx = out.indexOf(escapedRef);
    if (idx === -1) out = out + span;
    else out = out.slice(0, idx) + span + out.slice(idx + escapedRef.length);
  }
  return out;
}

/** Recursively find all elements with tag name (e.g. warning, caution) and extract their text (para or #text). */
function collectTextFromTag(node: unknown, tagName: string): string[] {
  const out: string[] = [];
  if (node == null) return out;

  if (typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    const child = obj[tagName];
    if (child !== undefined) {
      const nodes = Array.isArray(child) ? child : [child];
      for (const n of nodes) {
        const text = extractBlockText(n);
        if (text) out.push(text);
      }
    }
    for (const key of Object.keys(obj)) {
      if (key === tagName) continue;
      out.push(...collectTextFromTag(obj[key], tagName));
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      out.push(...collectTextFromTag(item, tagName));
    }
  }
  return out;
}

function extractBlockText(block: unknown): string {
  if (block == null) return '';
  if (typeof block === 'string') return block.trim();
  if (typeof block !== 'object') return '';
  const obj = block as Record<string, unknown>;
  const para = obj.para;
  if (typeof para === 'string') return para.trim();
  if (Array.isArray(para)) {
    return para.map((p) => (typeof p === 'string' ? p : (p as Record<string, unknown>)['#text'] as string)?.trim() ?? '').filter(Boolean).join(' ');
  }
  if (para && typeof para === 'object') {
    const t = (para as Record<string, unknown>)['#text'];
    if (typeof t === 'string') return t.trim();
  }
  const text = obj['#text'];
  return typeof text === 'string' ? text.trim() : '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Options for viewer HTML (e.g. show Maximo sync badge). */
interface ViewerOptions {
  fromMaximo?: boolean;
}

/**
 * Builds a full HTML5 document with MAXIMO Mobile Gateway branding for the manual.
 * Split view: text left, graphic right (sticky). Hotspots: internalRef ↔ SVG element by id.
 */
function buildViewerHtml(
  dmCode: string,
  content: ViewerContent,
  illustrationSvg: string | null,
  options: ViewerOptions = {}
): string {
  const { fromMaximo = false } = options;
  const title = content.title || dmCode;
  const subtitle = content.subtitle;
  const stepsHtmlArr = content.stepsHtml;
  const warnings = content.warnings;
  const cautions = content.cautions;
  // Use DB illustration first, else inline <figure> from XML (raw SVG, ids preserved)
  const graphicHtml = illustrationSvg ?? content.figureHtml ?? null;

  const stepsHtml =
    stepsHtmlArr.length > 0
      ? `<div class="steps">${stepsHtmlArr
          .map(
            (s, i) =>
              `<div class="step-item"><input type="checkbox" id="step-${i + 1}" class="step-checkbox" aria-label="Step ${i + 1}"><label for="step-${i + 1}" class="step-label">${s}</label></div>`
          )
          .join('')}</div>`
      : '<p class="no-steps">No procedural steps found in this data module.</p>';

  const warningsHtml =
    warnings.length > 0
      ? warnings
          .map((w) => `<div class="warning-box">${escapeHtml(w)}</div>`)
          .join('')
      : '';
  const cautionsHtml =
    cautions.length > 0
      ? cautions
          .map((c) => `<div class="caution-box">${escapeHtml(c)}</div>`)
          .join('')
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | MAXIMO Mobile Gateway</title>
  <meta property="og:title" content="MAXIMO Mobile Gateway | Škoda Transportation">
  <meta name="twitter:title" content="MAXIMO Mobile Gateway | Škoda Transportation">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html { font-size: 16px; }
    body {
      font-family: 'Inter', 'Roboto', system-ui, sans-serif;
      margin: 0;
      padding: 0;
      color: #212121;
      line-height: 1.5;
      background: #eaeff2;
      font-size: 1rem;
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
    .header .subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.95rem;
      opacity: 0.9;
    }
    .header .badge-wrap {
      margin-top: 0.5rem;
    }
    .badge-maximo {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      background: #009fe3;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .viewer-split {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 1rem 2rem;
    }
    .viewer-text {
      flex: 1 1 50%;
      min-width: 280px;
      padding-right: 1.5rem;
    }
    .viewer-graphic {
      flex: 0 0 360px;
      position: sticky;
      top: 1rem;
      align-self: start;
      padding: 1rem;
      background: #ffffff;
      border-radius: 4px;
      border: 1px solid #dde1e4;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    @media (max-width: 900px) {
      .viewer-graphic { position: relative; flex: 1 1 100%; }
    }
    @media (max-width: 767px) {
      .viewer-split {
        flex-direction: column;
        padding: 0 1rem 1.5rem;
      }
      .viewer-graphic {
        order: -1;
        flex: 1 1 100%;
        position: relative;
        top: 0;
        margin-bottom: 1rem;
      }
      .viewer-text {
        padding-right: 0;
      }
    }
    /* Technical drawings: white background, thin borders (CAD-style) */
    figure svg,
    .viewer-graphic svg {
      width: 100%;
      height: auto;
      max-width: 600px;
      display: block;
      margin: 20px auto;
      background: #ffffff;
      border: 1px solid #dde1e4;
    }
    .viewer-graphic svg {
      max-width: 320px;
      margin: 0 auto;
    }
    .viewer-graphic svg [id] {
      cursor: pointer;
      transition: fill 0.15s ease, transform 0.15s ease;
      transform-origin: center;
    }
    /* Highlight class for interactivity */
    .active-part {
      fill: #ff5252 !important;
      stroke: #d32f2f !important;
      stroke-width: 3px !important;
      transition: all 0.3s ease;
      transform-origin: center;
      transform: scale(1.1);
    }
    .viewer-graphic svg [id].hotspot-highlight,
    .viewer-graphic svg [id].active-part {
      fill: #ff5252 !important;
      stroke: #d32f2f !important;
      transform: scale(1.1);
    }
    .internal-ref {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-style: dotted;
      color: #009fe3;
    }
    .internal-ref:hover { color: #002855; }
    /* Highlight text link */
    .text-highlight {
      background-color: #ffeb3b;
      font-weight: bold;
    }
    .container { max-width: 100%; }
    .toolbar {
      margin-bottom: 1rem;
    }
    .toolbar a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0.75rem 1rem;
      color: #009fe3;
      text-decoration: none;
      font-weight: 500;
    }
    .toolbar a:hover {
      color: #002855;
      text-decoration: underline;
    }
    .graphic-placeholder {
      width: 100%;
      max-width: 320px;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: 1px dashed #ccc;
      background: #f5f5f5;
      color: #999;
      font-size: 0.9rem;
    }
    .dmc {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 1rem;
    }
    .warning-box {
      background: #ffe6e6;
      border-left: 5px solid red;
      padding: 10px;
      margin-bottom: 1rem;
      border-radius: 0 6px 6px 0;
    }
    .caution-box {
      background: #fffbe6;
      border-left: 5px solid orange;
      padding: 10px;
      margin-bottom: 1rem;
      border-radius: 0 6px 6px 0;
    }
    .steps {
      margin: 0 0 1rem;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .step-checkbox {
      flex-shrink: 0;
      margin-top: 0.35rem;
      cursor: pointer;
    }
    .step-label {
      cursor: pointer;
      flex: 1;
      margin: 0;
    }
    .step-label.step-done {
      opacity: 0.6;
      text-decoration: line-through;
    }
    .no-steps {
      color: #666;
      font-style: italic;
      margin: 0;
    }
    .btn-report-issue {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      min-height: 44px;
      padding: 0.75rem 1.25rem;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      background: #e65100;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .btn-report-issue:hover {
      background: #d84315;
    }
    .parts-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }
    .parts-section h3 {
      margin: 0 0 0.75rem;
      font-size: 1.1rem;
    }
    .parts-section table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    .parts-section th,
    .parts-section td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid #eee;
    }
    .parts-section th { background: #f5f5f5; color: #555; }
    @media (max-width: 767px) {
      .parts-section { display: none; }
    }
    .btn-show-parts {
      display: none;
      position: fixed;
      bottom: 1.5rem;
      left: 1.5rem;
      min-height: 44px;
      padding: 0.75rem 1.25rem;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      background: #1565c0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 100;
    }
    .btn-show-parts:hover { background: #0d47a1; }
    @media (max-width: 767px) {
      .btn-show-parts { display: inline-flex; align-items: center; }
    }
    .parts-sheet-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .parts-sheet-overlay.open {
      display: block;
      opacity: 1;
    }
    .parts-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      max-height: 70vh;
      background: #fff;
      border-radius: 12px 12px 0 0;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
      z-index: 1001;
      transform: translateY(100%);
      transition: transform 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    .parts-sheet.open {
      transform: translateY(0);
    }
    .parts-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    .parts-sheet-header h3 { margin: 0; font-size: 1.1rem; }
    .parts-sheet-close {
      min-height: 44px;
      min-width: 44px;
      padding: 0;
      border: none;
      background: transparent;
      font-size: 1.25rem;
      cursor: pointer;
      color: #666;
      border-radius: 8px;
    }
    .parts-sheet-close:hover { background: #f0f0f0; color: #333; }
    .parts-sheet-body {
      overflow: auto;
      padding: 1rem 1.25rem;
      -webkit-overflow-scrolling: touch;
    }
    .parts-sheet-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 1rem;
    }
    .parts-sheet-body th,
    .parts-sheet-body td {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #eee;
    }
    .parts-sheet-body th { background: #f5f5f5; color: #555; }
    .parts-sheet-body .empty { color: #666; padding: 1rem 0; }
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.open {
      display: flex;
    }
    .modal-box {
      background: #fff;
      padding: 1.5rem;
      border-radius: 8px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .modal-box h3 {
      margin: 0 0 1rem;
      font-size: 1.1rem;
    }
    .modal-box textarea {
      width: 100%;
      min-height: 100px;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 0.95rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      resize: vertical;
    }
    .modal-actions {
      margin-top: 1rem;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .modal-actions button {
      min-height: 44px;
      padding: 0.75rem 1.25rem;
      font-size: 1rem;
      border-radius: 6px;
      cursor: pointer;
    }
    .modal-actions .btn-cancel {
      background: #f0f0f0;
      border: 1px solid #ccc;
    }
    .modal-actions .btn-submit {
      background: #4ba82e;
      color: #fff;
      border: none;
    }
    .modal-actions .btn-submit:hover {
      background: #3d8f26;
    }
    .report-success {
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: #2e7d32;
    }
  </style>
</head>
<body data-dmc="${escapeHtml(dmCode).replace(/"/g, '&quot;')}">
  <header class="header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    ${fromMaximo ? '<div class="badge-wrap"><span class="badge-maximo">Sync with Maximo</span></div>' : ''}
  </header>
  <div class="viewer-split">
    <div class="viewer-text">
      <div class="toolbar">
        <a href="/">← Back to Dashboard</a>
      </div>
      <p class="dmc"><strong>DMC:</strong> ${escapeHtml(dmCode)}</p>
      ${warningsHtml}
      ${cautionsHtml}
      ${stepsHtml}
      <div class="parts-section" id="parts-section-desktop">
        <h3>Spare Parts (S2000M)</h3>
        <div id="parts-table-desktop">Loading…</div>
      </div>
    </div>
    <div class="viewer-graphic" id="viewer-graphic">
      ${graphicHtml ? graphicHtml : '<div class="graphic-placeholder">No illustration</div>'}
    </div>
  </div>
  <button type="button" class="btn-report-issue" id="btn-report-issue" aria-label="Report issue">⚠️ Report Issue</button>
  <button type="button" class="btn-show-parts" id="btn-show-parts" aria-label="Show parts list">📦 Show Parts</button>
  <div class="parts-sheet-overlay" id="parts-sheet-overlay" aria-hidden="true"></div>
  <div class="parts-sheet" id="parts-sheet" role="dialog" aria-labelledby="parts-sheet-title">
    <div class="parts-sheet-header">
      <h3 id="parts-sheet-title">Spare Parts (S2000M)</h3>
      <button type="button" class="parts-sheet-close" id="parts-sheet-close" aria-label="Close">×</button>
    </div>
    <div class="parts-sheet-body" id="parts-sheet-body">Loading…</div>
  </div>
  <div class="modal-overlay" id="feedback-modal" role="dialog" aria-labelledby="feedback-modal-title">
    <div class="modal-box">
      <h3 id="feedback-modal-title">Describe the issue...</h3>
      <input type="hidden" id="feedback-dmc" name="dmCode" value="${escapeHtml(dmCode).replace(/"/g, '&quot;')}">
      <textarea id="feedback-message" placeholder="Describe the issue..."></textarea>
      <div id="feedback-success" class="report-success" style="display:none;">Thank you! Engineering notified.</div>
      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="feedback-cancel">Cancel</button>
        <button type="button" class="btn-submit" id="feedback-submit">Send Report</button>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var dmcEl = document.getElementById('feedback-dmc');
      var dmc = (dmcEl && dmcEl.value) || document.body.getAttribute('data-dmc') || '';
      var modal = document.getElementById('feedback-modal');
      var messageEl = document.getElementById('feedback-message');
      var successEl = document.getElementById('feedback-success');
      document.getElementById('btn-report-issue').onclick = function() {
        messageEl.value = '';
        successEl.style.display = 'none';
        modal.classList.add('open');
      };
      document.getElementById('feedback-cancel').onclick = function() {
        modal.classList.remove('open');
      };
      document.getElementById('feedback-submit').onclick = function() {
        var message = (messageEl.value || '').trim();
        if (!message) return;
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dmCode: dmc, message: message })
        }).then(function(r) {
          if (r.ok) {
            successEl.style.display = 'block';
            setTimeout(function() {
              modal.classList.remove('open');
            }, 1500);
          }
        });
      };
    })();
  </script>
  <script>
    (function() {
      document.querySelectorAll('.step-checkbox').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var label = document.querySelector('label[for="' + cb.id + '"]');
          if (label) label.classList.toggle('step-done', cb.checked);
        });
      });
    })();
  </script>
  <script>
    (function() {
      function renderPartsTable(parts) {
        if (!parts || parts.length === 0) {
          return '<p class="empty">No spare parts. Import via <code>POST /api/s2000m/import</code>.</p>';
        }
        var rows = parts.map(function(p) {
          return '<tr><td><code>' + escapeHtml(p.partNumber) + '</code></td><td>' + escapeHtml(p.name) + '</td><td>' + p.quantity + '</td><td>' + escapeHtml(p.unit || '—') + '</td></tr>';
        }).join('');
        return '<table><thead><tr><th>Part Number</th><th>Name</th><th>Quantity</th><th>Unit</th></tr></thead><tbody>' + rows + '</tbody></table>';
      }
      function escapeHtml(s) {
        if (s == null) return '';
        var div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
      }
      var partsSheet = document.getElementById('parts-sheet');
      var partsSheetOverlay = document.getElementById('parts-sheet-overlay');
      var partsSheetBody = document.getElementById('parts-sheet-body');
      var partsTableDesktop = document.getElementById('parts-table-desktop');
      var partsLoaded = false;
      function loadParts() {
        if (partsLoaded) return;
        partsLoaded = true;
        fetch('/api/s2000m').then(function(r) { return r.json(); }).then(function(data) {
          var parts = data.parts || [];
          var html = renderPartsTable(parts);
          if (partsTableDesktop) partsTableDesktop.innerHTML = html;
          if (partsSheetBody) partsSheetBody.innerHTML = html;
        }).catch(function() {
          var err = '<p class="empty">Could not load parts.</p>';
          if (partsTableDesktop) partsTableDesktop.innerHTML = err;
          if (partsSheetBody) partsSheetBody.innerHTML = err;
        });
      }
      document.getElementById('btn-show-parts').onclick = function() {
        loadParts();
        partsSheet.classList.add('open');
        partsSheetOverlay.classList.add('open');
        partsSheetOverlay.setAttribute('aria-hidden', 'false');
      };
      function closePartsSheet() {
        partsSheet.classList.remove('open');
        partsSheetOverlay.classList.remove('open');
        partsSheetOverlay.setAttribute('aria-hidden', 'true');
      }
      document.getElementById('parts-sheet-close').onclick = closePartsSheet;
      partsSheetOverlay.onclick = closePartsSheet;
      loadParts();
    })();
  </script>
  <script>
    (function() {
      var graphic = document.getElementById('viewer-graphic');
      if (!graphic) return;
      var svg = graphic.querySelector('svg');
      function clearSvgHighlight() {
        if (svg) {
          svg.querySelectorAll('.hotspot-highlight').forEach(function(el) { el.classList.remove('hotspot-highlight'); });
          svg.querySelectorAll('.active-part').forEach(function(el) { el.classList.remove('active-part'); });
        }
      }
      function clearTextHighlight() {
        document.querySelectorAll('.text-highlight').forEach(function(el) { el.classList.remove('text-highlight'); });
      }
      // internalRef (text) -> SVG: hover/enter adds .active-part to SVG element by internalRefId
      document.querySelectorAll('.internal-ref').forEach(function(span) {
        var id = span.getAttribute('data-internal-ref-id');
        if (!id) return;
        span.addEventListener('mouseenter', function() {
          clearSvgHighlight();
          var el = svg && svg.querySelector('#' + CSS.escape(id));
          if (el) el.classList.add('active-part');
        });
        span.addEventListener('mouseleave', function() { clearSvgHighlight(); });
        span.addEventListener('click', function(e) {
          e.preventDefault();
          clearTextHighlight();
          span.classList.add('text-highlight');
          span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
      // Reverse: hover/click SVG part -> highlight corresponding text
      if (svg) {
        svg.querySelectorAll('[id]').forEach(function(el) {
          var id = el.id;
          if (!id) return;
          el.addEventListener('mouseenter', function() {
            clearSvgHighlight();
            el.classList.add('active-part');
          });
          el.addEventListener('mouseleave', function() { clearSvgHighlight(); });
          el.addEventListener('click', function() {
            clearTextHighlight();
            var ref = document.querySelector('.internal-ref[data-internal-ref-id="' + CSS.escape(id) + '"]');
            if (ref) {
              ref.classList.add('text-highlight');
              ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          });
        });
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * GET /viewer?dmc=...
 * Looks up DataModule by dmCode. Returns styled HTML manual (title, subtitle, steps).
 */
export async function getViewerByDmc(req: Request, res: Response): Promise<void> {
  const dmc = typeof req.query.dmc === 'string' ? req.query.dmc.trim() : '';
  if (!dmc) {
    res.status(400).send('Missing query parameter: dmc');
    return;
  }

  logger.info('Viewer request for dmc:', dmc);

  const dataModule = await prisma.dataModule.findUnique({
    where: { dmCode: dmc },
  });

  if (!dataModule) {
    logger.warn(`Viewer: DataModule not found for dmc=${dmc}`);
    res.status(404).send('Data Module not found');
    return;
  }

  const fromMaximo = req.query.from === 'maximo';
  const content = parseViewerContent(dataModule.xmlContent);
  const html = buildViewerHtml(dataModule.dmCode, content, dataModule.illustrationSvg ?? null, { fromMaximo });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

/**
 * GET /viewer/:dmCode (path-based viewer)
 * Fetches DataModule by dmCode from DB and returns styled HTML manual.
 */
export async function getViewerByDmCode(req: Request, res: Response): Promise<void> {
  const raw = req.params.dmCode;
  const dmCode = decodeURIComponent(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '');
  if (!dmCode.trim()) {
    res.status(400).send('Missing dmCode');
    return;
  }

  logger.info('Viewer request for dmCode:', dmCode);

  const dataModule = await prisma.dataModule.findUnique({
    where: { dmCode },
  });

  if (!dataModule) {
    logger.warn(`Viewer: DataModule not found for dmCode=${dmCode}`);
    res.status(404).send('Data Module not found');
    return;
  }

  const fromMaximo = req.query.from === 'maximo';
  const content = parseViewerContent(dataModule.xmlContent);
  const html = buildViewerHtml(dataModule.dmCode, content, dataModule.illustrationSvg ?? null, { fromMaximo });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
