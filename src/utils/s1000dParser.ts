import { XMLParser } from 'fast-xml-parser';

export interface S1000DDataModuleMetadata {
  dmCode: string;
  issueDate: string;
  techName: string;
  infoName: string;
}

/** S1000D dmCode can be element text or an object with attributes (e.g. modelIdentCode, systemDiffCode, systemCode, ...). */
const DMC_ATTR_ORDER = [
  'modelIdentCode',
  'systemDiffCode',
  'systemCode',
  'subSystemCode',
  'subSubSystemCode',
  'assyCode',
  'disassyCode',
  'disassyCodeVariant',
  'infoCode',
  'infoCodeVariant',
  'itemLocationCode',
  'learnCode',
  'learnCodeVariant',
  'conditionCode',
  'conditionCodeVariant',
] as const;

/**
 * Parses an S1000D Data Module XML string and extracts identification metadata.
 * Path: dmodule.identAndStatusSection.dmAddress.dmIdent.dmCode (and siblings).
 */
export function parseDataModule(xmlContent: string): S1000DDataModuleMetadata {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  const result = parser.parse(xmlContent);

  if (!result || typeof result !== 'object') {
    throw new Error('Invalid XML: could not parse');
  }

  console.log('Parsed XML:', JSON.stringify(result, null, 2));

  const dmodule = (result as Record<string, unknown>).dmodule;
  if (dmodule == null || typeof dmodule !== 'object') {
    throw new Error('S1000D XML: root element "dmodule" is missing');
  }

  const dmCode = extractDmCode(dmodule as Record<string, unknown>);
  if (!dmCode) {
    throw new Error(
      'S1000D XML: Data Module Code (dmCode) not found at path dmodule.identAndStatusSection.dmAddress.dmIdent.dmCode'
    );
  }

  const issueDate = extractIssueDate(dmodule as Record<string, unknown>);
  const techName = extractTechName(dmodule as Record<string, unknown>);
  const infoName = extractInfoName(dmodule as Record<string, unknown>);

  return {
    dmCode: dmCode.trim(),
    issueDate: (issueDate || '').trim(),
    techName: (techName || '').trim(),
    infoName: (infoName || '').trim(),
  };
}

function extractDmCode(dmodule: Record<string, unknown>): string {
  const ident = findPath(dmodule, [
    'identAndStatusSection',
    'dmAddress',
    'dmIdent',
  ]) as Record<string, unknown> | undefined;

  if (!ident) {
    return '';
  }

  const dmCodeNode = ident.dmCode;

  if (typeof dmCodeNode === 'string') {
    return dmCodeNode;
  }

  if (dmCodeNode != null && typeof dmCodeNode === 'object') {
    const obj = dmCodeNode as Record<string, unknown>;
    // Element text when there are attributes (fast-xml-parser uses #text)
    const text = obj['#text'];
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }
    // Build from attributes: modelIdentCode + '-' + systemDiffCode + ... OR just modelIdentCode
    const modelIdentCode = obj.modelIdentCode;
    if (typeof modelIdentCode === 'string' && modelIdentCode) {
      const parts: string[] = [];
      for (const key of DMC_ATTR_ORDER) {
        const v = obj[key];
        if (typeof v === 'string' && v) parts.push(v);
      }
      if (parts.length > 0) {
        return parts.join('-');
      }
      return modelIdentCode;
    }
  }

  return '';
}

function extractIssueDate(dmodule: Record<string, unknown>): string {
  const dmAddress = findPath(dmodule, [
    'identAndStatusSection',
    'dmAddress',
  ]) as Record<string, unknown> | undefined;
  if (dmAddress?.issueDate && typeof dmAddress.issueDate === 'string') {
    return dmAddress.issueDate;
  }
  const ident = findPath(dmodule, [
    'identAndStatusSection',
    'dmAddress',
    'dmIdent',
  ]) as Record<string, unknown> | undefined;
  if (ident?.issueDate && typeof ident.issueDate === 'string') {
    return ident.issueDate;
  }
  const issueInfo = ident?.issueInfo;
  if (issueInfo && typeof issueInfo === 'object') {
    const date = (issueInfo as Record<string, unknown>).issueDate;
    if (typeof date === 'string') return date;
  }
  return '';
}

function extractTechName(dmodule: Record<string, unknown>): string {
  const dmTitle = findPath(dmodule, [
    'identAndStatusSection',
    'dmAddress',
    'dmAddressItems',
    'dmTitle',
  ]);
  if (dmTitle && typeof dmTitle === 'object') {
    const name = (dmTitle as Record<string, unknown>).techName;
    if (typeof name === 'string') return name;
  }
  return '';
}

function extractInfoName(dmodule: Record<string, unknown>): string {
  const dmTitle = findPath(dmodule, [
    'identAndStatusSection',
    'dmAddress',
    'dmAddressItems',
    'dmTitle',
  ]);
  if (dmTitle && typeof dmTitle === 'object') {
    const name = (dmTitle as Record<string, unknown>).infoName;
    if (typeof name === 'string') return name;
  }
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

/**
 * Extracts the inner content of the first <figure>...</figure> from raw S1000D XML.
 * Used to output inline SVG exactly as stored (ids preserved for internalRef interaction).
 * Does not parse SVG as XML—returns the raw substring so <svg> and all attributes are preserved.
 */
export function extractFigureContent(xmlContent: string): string | null {
  if (!xmlContent || typeof xmlContent !== 'string') return null;
  const openTag = '<figure';
  const openEnd = '>';
  const closeTag = '</figure>';
  let start = xmlContent.indexOf(openTag);
  if (start === -1) return null;
  start = xmlContent.indexOf(openEnd, start);
  if (start === -1) return null;
  start += openEnd.length;
  let depth = 1;
  let pos = start;
  while (depth > 0 && pos < xmlContent.length) {
    const nextOpen = xmlContent.indexOf(openTag, pos);
    const nextClose = xmlContent.indexOf(closeTag, pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      pos = nextOpen + openTag.length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return xmlContent.slice(start, nextClose).trim();
    pos = nextClose + closeTag.length;
  }
  return null;
}
