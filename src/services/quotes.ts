export type { MarketQuote } from '../domains/market/legacyAdapter.js';
import { marketDataService, toLegacyMarketQuotes } from '../domains/market/index.js';

// Deprecated V1 entry point; new callers depend on MarketDataService.
export async function fetchMarketQuotes(symbols: string[]) {
  return toLegacyMarketQuotes(await marketDataService.getQuotes(symbols));
}
