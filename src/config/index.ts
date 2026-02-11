export type AppMode = 'MOCK' | 'REAL';

const raw = (process.env.APP_MODE ?? 'MOCK').toUpperCase();
export const APP_MODE: AppMode = raw === 'REAL' ? 'REAL' : 'MOCK';

export const MAXIMO_URL = (process.env.MAXIMO_URL ?? 'https://maximo-dev.skoda.cz').replace(/\/$/, '');
export const MAXIMO_API_KEY = process.env.MAXIMO_API_KEY ?? '';

export const config = {
  APP_MODE,
  MAXIMO_URL,
  MAXIMO_API_KEY,
} as const;
