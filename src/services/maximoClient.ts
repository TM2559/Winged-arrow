import axios, { AxiosInstance } from 'axios';
import { APP_MODE, MAXIMO_URL, MAXIMO_API_KEY } from '../config';
import { logger } from '../utils/logger';

/** Result of a work order lookup used for S1000D link generation */
export interface WorkOrderLinkRecord {
  asset: string;
  dmc: string;
  model: string;
}

/** Static mock data for work orders (WO -> asset, dmc, model) */
const MOCK_WORK_ORDERS: Record<string, WorkOrderLinkRecord> = {
  WO1001: {
    asset: '109E-LOC-01',
    dmc: 'DMC-SKODA-BRZDA-MAIN-01',
    model: '109E',
  },
  WO1002: {
    asset: '109E-LOC-02',
    dmc: 'DMC-SKODA-PNEUMATIKA-01',
    model: '109E',
  },
};

/** Static mock data for assets (assetnum -> description, etc.) */
const MOCK_ASSETS = [
  { assetnum: '109E-LOC-01', description: 'Locomotive 109E #01', siteid: 'SKODA' },
  { assetnum: '109E-LOC-02', description: 'Locomotive 109E #02', siteid: 'SKODA' },
];

/** Static mock data for work orders list (for consistency with REAL API shape) */
const MOCK_WORK_ORDERS_LIST = [
  { wonum: 'WO1001', description: 'Brake system inspection', assetnum: '109E-LOC-01', status: 'WAPPR' },
  { wonum: 'WO1002', description: 'Pneumatic system check', assetnum: '109E-LOC-02', status: 'WAPPR' },
];

function createMaximoAxios(): AxiosInstance {
  const client = axios.create({
    baseURL: `${MAXIMO_URL}/maximo/oslc`,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(MAXIMO_API_KEY && { apikey: MAXIMO_API_KEY }),
    },
  });
  return client;
}

/**
 * Fetch work order by number from Maximo OSLC API.
 * Returns the record needed for S1000D link (asset, dmc, model).
 * In REAL mode, DMC/model may come from asset extended attributes or mapping;
 * if not present, they are derived from assetnum/description.
 */
export async function getWorkOrderByNum(wonum: string): Promise<WorkOrderLinkRecord | null> {
  if (APP_MODE === 'MOCK') {
    const record = MOCK_WORK_ORDERS[wonum] ?? null;
    if (record) logger.debug(`Maximo (MOCK): work order ${wonum} -> asset ${record.asset}`);
    return record;
  }

  try {
    const client = createMaximoAxios();
    const where = `wonum="${wonum}"`;
    const select = 'wonum,assetnum,description';
    const url = `/os/mxwo?oslc.where=${encodeURIComponent(where)}&oslc.select=${encodeURIComponent(select)}`;
    const res = await client.get<{ member?: Array<Record<string, unknown>> }>(url);

    const member = res.data?.member;
    if (!Array.isArray(member) || member.length === 0) {
      logger.debug(`Maximo (REAL): no work order found for ${wonum}`);
      return null;
    }

    const wo = member[0];
    const assetnum = String(wo.assetnum ?? '').trim();
    if (!assetnum) {
      logger.warn(`Maximo (REAL): work order ${wonum} has no asset`);
      return null;
    }

    // DMC/model may be in custom/extended attributes in your Maximo; map as needed.
    const dmc = String((wo as Record<string, unknown>).dmc ?? '').trim() || `DMC-${assetnum}-MAIN-01`;
    const model = String((wo as Record<string, unknown>).model ?? '').trim() || (assetnum.split('-')[0] || 'default');

    logger.info(`Maximo (REAL): work order ${wonum} -> asset ${assetnum}`);
    return { asset: assetnum, dmc, model };
  } catch (err) {
    logger.error(`Maximo (REAL): failed to fetch work order ${wonum}: ${axios.isAxiosError(err) ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Return static list of work orders (MOCK) or fetch from Maximo OSLC (REAL).
 */
export async function getWorkOrders(): Promise<Array<{ wonum: string; description?: string; assetnum?: string; status?: string }>> {
  if (APP_MODE === 'MOCK') {
    return MOCK_WORK_ORDERS_LIST;
  }

  try {
    const client = createMaximoAxios();
    const select = 'wonum,description,assetnum,status';
    const res = await client.get<{ member?: Array<Record<string, unknown>> }>(`/os/mxwo?oslc.select=${encodeURIComponent(select)}&oslc.pagesize=50`);
    const member = res.data?.member;
    if (!Array.isArray(member)) return [];
    return member.map((wo) => ({
      wonum: String(wo.wonum ?? ''),
      description: wo.description as string | undefined,
      assetnum: wo.assetnum as string | undefined,
      status: wo.status as string | undefined,
    }));
  } catch (err) {
    logger.error(`Maximo (REAL): failed to fetch work orders: ${axios.isAxiosError(err) ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Return static list of assets (MOCK) or fetch from Maximo OSLC (REAL).
 */
export async function getAssets(): Promise<Array<{ assetnum: string; description?: string; siteid?: string }>> {
  if (APP_MODE === 'MOCK') {
    return MOCK_ASSETS;
  }

  try {
    const client = createMaximoAxios();
    const select = 'assetnum,description,siteid';
    const res = await client.get<{ member?: Array<Record<string, unknown>> }>(`/os/mxasset?oslc.select=${encodeURIComponent(select)}&oslc.pagesize=50`);
    const member = res.data?.member;
    if (!Array.isArray(member)) return [];
    return member.map((a) => ({
      assetnum: String(a.assetnum ?? ''),
      description: a.description as string | undefined,
      siteid: a.siteid as string | undefined,
    }));
  } catch (err) {
    logger.error(`Maximo (REAL): failed to fetch assets: ${axios.isAxiosError(err) ? err.message : String(err)}`);
    return [];
  }
}
