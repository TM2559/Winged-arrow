import { Request, Response } from 'express';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/** Parsed viewer content from S1000D XML (title, subtitle, steps, warnings, cautions). */
interface ViewerContent {
  title: string;
  subtitle: string;
  steps: string[];
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

  const steps = collectProceduralSteps(dmodule);
  const warnings = collectTextFromTag(dmodule, 'warning');
  const cautions = collectTextFromTag(dmodule, 'caution');

  return {
    title: title || 'S1000D Data Module',
    subtitle,
    steps,
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

/** Recursively find all proceduralStep nodes and extract para text. */
function collectProceduralSteps(node: unknown): string[] {
  const steps: string[] = [];
  if (node == null) return steps;

  if (typeof node === 'object' && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    if (obj.proceduralStep !== undefined) {
      const stepNodes = Array.isArray(obj.proceduralStep) ? obj.proceduralStep : [obj.proceduralStep];
      for (const step of stepNodes) {
        const text = extractParaText(step);
        if (text) steps.push(text);
      }
    }
    for (const key of Object.keys(obj)) {
      if (key === 'proceduralStep') continue;
      steps.push(...collectProceduralSteps(obj[key]));
    }
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      steps.push(...collectProceduralSteps(item));
    }
  }
  return steps;
}

function extractParaText(stepNode: unknown): string {
  if (stepNode == null) return '';
  if (typeof stepNode === 'string') return stepNode.trim();
  if (typeof stepNode !== 'object') return '';
  const obj = stepNode as Record<string, unknown>;
  const para = obj.para;
  if (typeof para === 'string') return para.trim();
  if (Array.isArray(para)) {
    return para.map((p) => (typeof p === 'string' ? p : (p as Record<string, unknown>)['#text'] as string)?.trim() ?? '').filter(Boolean).join(' ');
  }
  if (para && typeof para === 'object') {
    const text = (para as Record<string, unknown>)['#text'];
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
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

const PLACEHOLDER_GRAPHIC_URL = 'https://placehold.co/600x400?text=Technical+Drawing';

/**
 * Builds a full HTML5 document with Škoda branding for the manual.
 * Includes placeholder graphic, warning/caution boxes, and link back to dashboard.
 */
function buildViewerHtml(dmCode: string, content: ViewerContent): string {
  const title = content.title || dmCode;
  const subtitle = content.subtitle;
  const steps = content.steps;
  const warnings = content.warnings;
  const cautions = content.cautions;

  const stepsHtml =
    steps.length > 0
      ? `<ol class="steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
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
    .container {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 2rem 2rem;
    }
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
      max-width: 600px;
      height: auto;
      display: block;
      margin: 0 0 1.5rem;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      background: #f5f5f5;
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
  </style>
</head>
<body>
  <header class="header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  </header>
  <div class="container">
    <div class="toolbar">
      <a href="/">← Back to Dashboard</a>
    </div>
    <p class="dmc"><strong>DMC:</strong> ${escapeHtml(dmCode)}</p>
    <img class="graphic-placeholder" src="${PLACEHOLDER_GRAPHIC_URL}" alt="Technical drawing placeholder" />
    ${warningsHtml}
    ${cautionsHtml}
    ${stepsHtml}
  </div>
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

  const content = parseViewerContent(dataModule.xmlContent);
  const html = buildViewerHtml(dataModule.dmCode, content);
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

  const content = parseViewerContent(dataModule.xmlContent);
  const html = buildViewerHtml(dataModule.dmCode, content);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
