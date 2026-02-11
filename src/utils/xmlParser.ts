import { XMLParser } from 'fast-xml-parser';

export interface S1000DExtract {
  dmc: string;
  title: string;
}

/**
 * S1000D XML parser: extracts Data Module Code (DMC) and Title from an S1000D data module XML string.
 * Supports common S1000D structures (identSection/dmAddress, dmCode, techName, description/title).
 */
export function parseS1000DXml(xmlString: string): S1000DExtract {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });

  const obj = parser.parse(xmlString);
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid XML: could not parse');
  }

  const dmc = extractDmc(obj);
  const title = extractTitle(obj);

  if (!dmc) {
    throw new Error('S1000D XML: Data Module Code (DMC) not found');
  }

  return {
    dmc: dmc.trim(),
    title: (title || '').trim() || 'Untitled',
  };
}

function extractDmc(root: unknown): string {
  const o = root as Record<string, unknown>;

  // Direct dmCode (e.g. root.dmodule.identAndStatusSection.dmAddress.dmIdent.dmCode)
  const ident = findPath(o, [
    'dmodule',
    'identAndStatusSection',
    'dmAddress',
    'dmIdent',
  ]);
  if (ident && typeof ident === 'object') {
    const code = (ident as Record<string, unknown>).dmCode;
    if (typeof code === 'string') return code;
  }

  // Alternative: identSection
  const identAlt = findPath(o, ['identSection', 'dmAddress', 'dmIdent']);
  if (identAlt && typeof identAlt === 'object') {
    const code = (identAlt as Record<string, unknown>).dmCode;
    if (typeof code === 'string') return code;
  }

  // Root-level dmCode (simplified samples)
  const rootDmc = o.dmCode ?? o.dmc;
  if (typeof rootDmc === 'string') return rootDmc;

  // Nested under content or ident
  const content = o.content ?? o.ident;
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    const code = c.dmCode ?? c.dmc;
    if (typeof code === 'string') return code;
  }

  return '';
}

function extractTitle(root: unknown): string {
  const o = root as Record<string, unknown>;

  // identAndStatusSection -> dmAddress -> dmIdent -> techName (or description)
  const ident = findPath(o, [
    'dmodule',
    'identAndStatusSection',
    'dmAddress',
    'dmIdent',
  ]);
  if (ident && typeof ident === 'object') {
    const identRec = ident as Record<string, unknown>;
    const tech = identRec.techName ?? identRec.title;
    if (typeof tech === 'string') return tech;
  }

  const identAlt = findPath(o, ['identSection', 'dmAddress', 'dmIdent']);
  if (identAlt && typeof identAlt === 'object') {
    const identRec = identAlt as Record<string, unknown>;
    const tech = identRec.techName ?? identRec.title;
    if (typeof tech === 'string') return tech;
  }

  // content.description.title or content.title
  const content = o.content ?? o.description;
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    const desc = c.description ?? c;
    if (desc && typeof desc === 'object') {
      const t = (desc as Record<string, unknown>).title;
      if (typeof t === 'string') return t;
    }
    const t = c.title;
    if (typeof t === 'string') return t;
  }

  // Root-level title
  const rootTitle = o.title ?? o.techName;
  if (typeof rootTitle === 'string') return rootTitle;

  return '';
}

function findPath(
  root: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
