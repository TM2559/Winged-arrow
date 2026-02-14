import { Request, Response } from 'express';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/** Parsed viewer content from S1000D XML (title, subtitle, steps as HTML, warnings, cautions). */
interface ViewerContent {
  title: string;
  subtitle: string;
  stepsHtml: string[];
  warnings: string[];
  cautions: string[];
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

  return {
    title: title || 'S1000D Data Module',
    subtitle,
    stepsHtml,
    warnings,
    cautions,
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
 * Builds a full HTML5 document with Škoda branding for the manual.
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

  const stepsHtml =
    stepsHtmlArr.length > 0
      ? `<ol class="steps">${stepsHtmlArr.map((s) => `<li>${s}</li>`).join('')}</ol>`
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} – S1000D Viewer</title>
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
      padding: 1.25rem 2rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    .header .subtitle {
      margin: 0.25rem 0 0;
      font-size: 1rem;
      opacity: 0.95;
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
      background: #003a6b;
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
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    @media (max-width: 900px) {
      .viewer-graphic { position: relative; flex: 1 1 100%; }
    }
    .viewer-graphic svg {
      display: block;
      width: 100%;
      height: auto;
      max-width: 320px;
    }
    .viewer-graphic svg [id] {
      cursor: pointer;
      transition: fill 0.15s ease, transform 0.15s ease;
      transform-origin: center;
    }
    .viewer-graphic svg [id].hotspot-highlight {
      fill: #c62828 !important;
      stroke: #c62828 !important;
      transform: scale(1.2);
    }
    .internal-ref {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-style: dotted;
      color: #1565c0;
    }
    .internal-ref:hover { color: #0d47a1; }
    .text-highlight { background: #fff59d; }
    .container { max-width: 100%; }
    .toolbar {
      margin-bottom: 1rem;
    }
    .toolbar a {
      color: #4ba82e;
      text-decoration: none;
      font-weight: 500;
    }
    .toolbar a:hover {
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
      padding-left: 1.5rem;
      margin: 0 0 1rem;
    }
    .steps li {
      margin-bottom: 0.75rem;
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
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #fff;
      background: #c62828;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .btn-report-issue:hover {
      background: #b71c1c;
    }
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
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
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
    </div>
    <div class="viewer-graphic" id="viewer-graphic">
      ${illustrationSvg ? illustrationSvg : '<div class="graphic-placeholder">No illustration</div>'}
    </div>
  </div>
  <button type="button" class="btn-report-issue" id="btn-report-issue" aria-label="Report issue">⚠️ Report Issue</button>
  <div class="modal-overlay" id="feedback-modal" role="dialog" aria-labelledby="feedback-modal-title">
    <div class="modal-box">
      <h3 id="feedback-modal-title">Describe the issue...</h3>
      <textarea id="feedback-message" placeholder="Describe the issue..."></textarea>
      <div id="feedback-success" class="report-success" style="display:none;">Thank you. Your report has been submitted.</div>
      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="feedback-cancel">Cancel</button>
        <button type="button" class="btn-submit" id="feedback-submit">Submit</button>
      </div>
    </div>
  </div>
  <script>
    (function() {
      var dmc = document.body.getAttribute('data-dmc') || '';
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
      var graphic = document.getElementById('viewer-graphic');
      if (!graphic) return;
      var svg = graphic.querySelector('svg');
      function clearSvgHighlight() {
        if (svg) svg.querySelectorAll('.hotspot-highlight').forEach(function(el) { el.classList.remove('hotspot-highlight'); });
      }
      function clearTextHighlight() {
        document.querySelectorAll('.text-highlight').forEach(function(el) { el.classList.remove('text-highlight'); });
      }
      document.querySelectorAll('.internal-ref').forEach(function(span) {
        var id = span.getAttribute('data-internal-ref-id');
        if (!id) return;
        span.addEventListener('mouseenter', function() {
          clearSvgHighlight();
          var el = svg && svg.querySelector('#' + CSS.escape(id));
          if (el) el.classList.add('hotspot-highlight');
        });
        span.addEventListener('mouseleave', function() { clearSvgHighlight(); });
        span.addEventListener('click', function(e) {
          e.preventDefault();
          clearTextHighlight();
          span.classList.add('text-highlight');
          span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
      if (svg) {
        svg.querySelectorAll('[id]').forEach(function(el) {
          var id = el.id;
          if (!id) return;
          el.addEventListener('mouseenter', function() {
            clearSvgHighlight();
            el.classList.add('hotspot-highlight');
          });
          el.addEventListener('mouseleave', function() { clearSvgHighlight(); });
          el.addEventListener('click', function() {
            clearTextHighlight();
            var ref = document.querySelector('.internal-ref[data-internal-ref-id="' + id + '"]');
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
