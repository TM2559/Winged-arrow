import axios from 'axios';
import { logger } from '../utils/logger';
import { APP_MODE, MAXIMO_URL, MAXIMO_API_KEY } from '../config';

/** Payload sent to Maximo Item Master (OSLC mxitem) */
export interface MaximoItemMasterPayload {
  itemnum: string;
  description: string;
  orderunit: string;
  [key: string]: unknown;
}

/**
 * @class MaximoOslcClient
 * @description Handles direct communication with IBM Maximo OSLC API
 */
class MaximoOslcClient {
  private client = axios.create({
    baseURL: MAXIMO_URL,
    headers: {
      apikey: MAXIMO_API_KEY,
      'Content-Type': 'application/json',
      'x-public-uri': MAXIMO_URL,
    },
    timeout: 5000,
  });

  /**
   * @description Sends a mapped item to Maximo Item Master
   * @param mappedItem Clean data prepared for Maximo
   */
  async createItemMaster(mappedItem: MaximoItemMasterPayload): Promise<{ status: number; data: unknown }> {
    try {
      logger.info(`Sending item ${mappedItem.itemnum} to Maximo...`);

      if (APP_MODE === 'MOCK') {
        return { status: 201, data: { message: 'MOCKED: Item created' } };
      }

      const response = await this.client.post('/oslc/os/mxitem', mappedItem);
      return { status: response.status, data: response.data };
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : err instanceof Error
            ? err.message
            : String(err);
      logger.error(`Maximo OSLC Error: ${message}`);
      throw err;
    }
  }
}

export const maximoOslcClient = new MaximoOslcClient();
