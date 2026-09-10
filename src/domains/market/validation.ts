import type { MarketDataSource, NormalizedQuote, RawQuote, VerifiedQuote } from './types.js';

export interface QuoteValidationPolicy {
  readonly now: string;
  readonly maxAgeMs: number;
  readonly maxTimeDifferenceMs: number;
  readonly maxFutureSkewMs: number;
  readonly maxPriceDifferencePct: number;
}
export interface QuoteCandidate {
  readonly quote: NormalizedQuote;
  readonly raw: readonly RawQuote[];
}
const timestamp = (value: string) =>
  /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;

// Pure validation: no inferred exchange calendar, provider calls, or storage writes.
export function quoteIssues(quote: NormalizedQuote): string[] {
  const issues: string[] = [];
  if (!quote.symbol || !['CN_A', 'US'].includes(quote.market)) issues.push('identity');
  if (![quote.last, quote.prevClose].every(n => Number.isFinite(n) && n > 0) ||
    !Number.isFinite(quote.changePct)) issues.push('price');
  if ([quote.open, quote.high, quote.low].some(n => n !== null && (!Number.isFinite(n) || n <= 0))) issues.push('ohlc');
  if (quote.high !== null && quote.low !== null && quote.high < quote.low) issues.push('range');
  if ([quote.volume, quote.turnover].some(n => n !== null && (!Number.isFinite(n) || n < 0))) issues.push('activity');
  if (![quote.quoteTime, quote.receivedAt].every(t => Number.isFinite(timestamp(t)))) issues.push('timestamp');
  return issues;
}

export function reconcileQuotes(
  symbol: string,
  primarySource: MarketDataSource,
  secondarySource: MarketDataSource | null,
  primary: QuoteCandidate | null,
  secondary: QuoteCandidate | null,
  policy: QuoteValidationPolicy,
): VerifiedQuote {
  const now = timestamp(policy.now);
  if (!Number.isFinite(now) || ![
    policy.maxAgeMs, policy.maxTimeDifferenceMs, policy.maxFutureSkewMs, policy.maxPriceDifferencePct,
  ].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid quote validation policy');
  const raw = [...(primary?.raw ?? []), ...(secondary?.raw ?? [])];
  const valid = (candidate: QuoteCandidate | null, source: MarketDataSource | null) =>
    candidate && source && candidate.quote.symbol === symbol &&
    candidate.quote.source.id === source.id && candidate.quote.source.kind === source.kind &&
    quoteIssues(candidate.quote).length === 0 ? candidate.quote : null;
  const p = valid(primary, primarySource);
  const s = valid(secondary, secondarySource);
  const usable = (quote: NormalizedQuote | null) => quote !== null &&
    quote.source.kind === 'REALTIME' && quote.session === 'CONTINUOUS' &&
    now - timestamp(quote.quoteTime) <= policy.maxAgeMs &&
    timestamp(quote.quoteTime) - now <= policy.maxFutureSkewMs &&
    timestamp(quote.receivedAt) - now <= policy.maxFutureSkewMs &&
    timestamp(quote.quoteTime) - timestamp(quote.receivedAt) <= policy.maxFutureSkewMs;
  const result = (status: VerifiedQuote['status'], quote: NormalizedQuote | null, conflicts: string[] = []): VerifiedQuote => ({
    symbol, quote, status, primarySource, secondarySource, confidence: null,
    stalenessMs: quote ? Math.max(0, now - timestamp(quote.quoteTime)) : null, conflicts, raw,
  });
  const freshP = usable(p) ? p : null;
  const freshS = usable(s) ? s : null;
  if (!freshP && !freshS) return result(p || s ? 'STALE' : 'UNAVAILABLE', p ?? s);
  if (!freshP) return result('SECONDARY_ONLY', freshS);
  if (!freshS) return result('PRIMARY_ONLY', freshP);
  // Same provider twice cannot establish independent verification.
  if (primarySource.id === secondarySource?.id) return result('PRIMARY_ONLY', freshP);
  // Check comparability before price differences; asynchronous samples aren't price conflicts.
  if (freshP.market !== freshS.market ||
    new Intl.DateTimeFormat('en-CA', { timeZone: freshP.market === 'CN_A' ? 'Asia/Shanghai' : 'America/New_York' }).format(new Date(freshP.quoteTime)) !==
    new Intl.DateTimeFormat('en-CA', { timeZone: freshS.market === 'CN_A' ? 'Asia/Shanghai' : 'America/New_York' }).format(new Date(freshS.quoteTime)) ||
    Math.abs(timestamp(freshP.quoteTime) - timestamp(freshS.quoteTime)) > policy.maxTimeDifferenceMs) {
    return result('PRIMARY_ONLY', freshP);
  }
  const conflicts: string[] = [];
  const differs = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) * 100 > policy.maxPriceDifferencePct;
  if (differs(freshP.last, freshS.last)) conflicts.push('last');
  if (differs(freshP.prevClose, freshS.prevClose)) conflicts.push('prevClose');
  for (const field of ['open', 'high', 'low'] as const) {
    const a = freshP[field], b = freshS[field];
    if (a !== null && b !== null && differs(a, b)) conflicts.push(field);
  }
  return result(conflicts.length ? 'CONFLICT' : 'VERIFIED', freshP, conflicts);
}

// Opt-in single-source degradation; default is independent verification only.
export function canUseForRealtimeStrategy(result: VerifiedQuote, policy: QuoteValidationPolicy, allowSingleSource = false): boolean {
  const quote = result.quote;
  if (!quote || quoteIssues(quote).length || result.conflicts.length || result.symbol !== quote.symbol) return false;
  if (result.status !== 'VERIFIED' && !(allowSingleSource && ['PRIMARY_ONLY', 'SECONDARY_ONLY'].includes(result.status))) return false;
  const candidate = { quote, raw: result.raw };
  const check = reconcileQuotes(result.symbol, quote.source, null, candidate, null, policy);
  return check.status === 'PRIMARY_ONLY';
}
