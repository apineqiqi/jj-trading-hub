export const QuoteValidationStatus = {
  VERIFIED: 'VERIFIED', PRIMARY_ONLY: 'PRIMARY_ONLY', SECONDARY_ONLY: 'SECONDARY_ONLY',
  STALE: 'STALE', CONFLICT: 'CONFLICT', UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type QuoteValidationStatus = typeof QuoteValidationStatus[keyof typeof QuoteValidationStatus];
export type MarketSession = 'PRE_OPEN' | 'CONTINUOUS' | 'BREAK' | 'CLOSING_AUCTION' | 'CLOSED' | 'HALTED' | 'UNKNOWN';
export interface MarketDataSource {
  readonly id: 'legacy-eastmoney' | 'ifind' | 'choice' | 'wind' | 'tushare';
  readonly kind: 'DELAYED' | 'REALTIME' | 'HISTORICAL';
}
export interface RawQuote<T = unknown> {
  readonly source: MarketDataSource;
  readonly providerSymbol: string;
  readonly providerTimestamp: number | string | null;
  readonly receivedAt: string;
  readonly rawPayload: T;
}
export interface NormalizedQuote {
  readonly symbol: string;
  readonly name: string;
  readonly market: 'CN_A' | 'US';
  readonly last: number;
  readonly changePct: number;
  readonly open: number | null;
  readonly high: number | null;
  readonly low: number | null;
  readonly prevClose: number;
  readonly volume: number | null;
  readonly turnover: number | null;
  readonly quoteTime: string;
  readonly receivedAt: string;
  readonly session: MarketSession;
  readonly source: MarketDataSource;
}
export interface VerifiedQuote {
  readonly symbol: string;
  readonly quote: NormalizedQuote | null;
  readonly status: QuoteValidationStatus;
  readonly primarySource: MarketDataSource;
  readonly secondarySource: MarketDataSource | null;
  // Null means unassessed, never an invented confidence score.
  readonly confidence: number | null;
  readonly stalenessMs: number | null;
  readonly conflicts: readonly string[];
  readonly raw: readonly RawQuote[];
}
