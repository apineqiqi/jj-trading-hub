import type { VerifiedQuote } from './types.js';
export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  previousClose: number;
  updatedAt: string;
}
// V1 display bridge intentionally preserves delayed-price refresh behavior.
// This adapter is not permission for a V2 strategy to consume stale quotes.
export function toLegacyMarketQuotes(quotes: readonly VerifiedQuote[]): MarketQuote[] {
  return quotes.flatMap(({ quote }) => quote ? [{
    symbol: quote.symbol, name: quote.name, price: quote.last,
    changePct: quote.changePct, previousClose: quote.prevClose, updatedAt: quote.quoteTime,
  }] : []);
}
