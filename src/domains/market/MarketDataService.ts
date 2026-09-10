import type { VerifiedQuote } from './types.js';
export interface MarketDataService {
  getQuotes(symbols: readonly string[]): Promise<readonly VerifiedQuote[]>;
}
