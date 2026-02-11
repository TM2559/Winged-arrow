const PORT = Number(process.env.PORT) || 3000;
const VIEWER_BASE = `http://localhost:${PORT}/viewer/index.html`;

/**
 * Builds the S1000D viewer URL with optional train serial number (applicability).
 * @param dmc - Data Module Code
 * @param model - Model identifier
 * @param serialNumber - Optional train/serial number; when provided, appended as &sn=VALUE
 */
export function buildViewerUrl(
  dmc: string,
  model: string,
  serialNumber?: string
): string {
  const params = new URLSearchParams();
  params.set('dmc', dmc);
  params.set('model', model);
  if (serialNumber != null && String(serialNumber).trim() !== '') {
    params.set('sn', String(serialNumber).trim());
  }
  return `${VIEWER_BASE}?${params.toString()}`;
}
