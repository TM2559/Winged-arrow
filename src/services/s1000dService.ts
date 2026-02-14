const PORT = Number(process.env.PORT) || 3000;
const VIEWER_BASE = `http://localhost:${PORT}/viewer`;
const MOCK_VIEWER_BASE = `${VIEWER_BASE}/index.html`;

/**
 * Builds the S1000D native viewer URL (Data Module by dmCode from DB).
 * Use this for upload responses so the link opens the stored Data Module.
 */
export function buildViewerUrl(dmc: string, _model?: string, _serialNumber?: string): string {
  return `${VIEWER_BASE}/${encodeURIComponent(dmc)}`;
}

/**
 * Builds the legacy mock viewer URL with query params (for link-by-WO flow if needed).
 */
export function buildMockViewerUrl(dmc: string, model: string, serialNumber?: string): string {
  const params = new URLSearchParams();
  params.set('dmc', dmc);
  params.set('model', model);
  if (serialNumber != null && String(serialNumber).trim() !== '') {
    params.set('sn', String(serialNumber).trim());
  }
  return `${MOCK_VIEWER_BASE}?${params.toString()}`;
}
