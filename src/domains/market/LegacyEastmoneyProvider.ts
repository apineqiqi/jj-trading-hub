import type { MarketDataService } from './MarketDataService.js';
import type { MarketDataSource, NormalizedQuote, RawQuote, VerifiedQuote } from './types.js';

export interface EastmoneyQuote {
  readonly f2: number | '-';
  readonly f3: number | '-';
  readonly f12: string;
  readonly f14: string;
  readonly f18: number | '-';
  readonly f124: number;
}
const source: MarketDataSource = Object.freeze({ id: 'legacy-eastmoney', kind: 'DELAYED' });

export function normalizeEastmoney(raw: RawQuote<EastmoneyQuote>): NormalizedQuote | null {
  const item = raw.rawPayload;
  if (typeof item.f2 !== 'number' || typeof item.f3 !== 'number' || typeof item.f18 !== 'number' ||
    ![item.f2, item.f3, item.f18, item.f124].every(Number.isFinite) ||
    item.f2 <= 0 || item.f18 <= 0 || !/^\d{6}$/.test(item.f12) ||
    !Number.isFinite(new Date(item.f124 * 1000).getTime())) return null;
  return {
    symbol: item.f12, name: item.f14, market: 'CN_A', last: item.f2 / 100,
    changePct: item.f3 / 100, prevClose: item.f18 / 100,
    quoteTime: new Date(item.f124 * 1000).toISOString(), receivedAt: raw.receivedAt,
    open: null, high: null, low: null, volume: null, turnover: null,
    session: 'UNKNOWN', source: raw.source,
  };
}

// Delayed legacy feed is never asserted to be realtime or dual-source VERIFIED.
export class LegacyEastmoneyProvider implements MarketDataService {
  constructor(
    private readonly request: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getQuotes(symbols: readonly string[]): Promise<readonly VerifiedQuote[]> {
    const uniqueSymbols = Array.from(new Set(symbols.filter(symbol => /^\d{6}$/.test(symbol))));
    if (!uniqueSymbols.length) return [];
    const secids = uniqueSymbols.map(symbol => `${symbol.startsWith('6') ? '1' : '0'}.${symbol}`).join(',');
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.request(`https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=${encodeURIComponent(secids)}&fields=f2,f3,f12,f14,f18,f124`, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!response.ok) throw new Error(`行情服务返回 ${response.status}`);
      const payload = await response.json() as { data?: { diff?: EastmoneyQuote[] } };
      const receivedAt = this.now().toISOString();
      return (payload.data?.diff ?? []).map(item => {
        const raw: RawQuote<EastmoneyQuote> = Object.freeze({
          source, providerSymbol: item.f12, providerTimestamp: item.f124,
          receivedAt, rawPayload: Object.freeze({ ...item }),
        });
        const quote = normalizeEastmoney(raw);
        return {
          symbol: item.f12, quote, status: quote ? 'STALE' : 'UNAVAILABLE',
          primarySource: source, secondarySource: null, confidence: null,
          stalenessMs: quote ? Math.max(0, Date.parse(receivedAt) - Date.parse(quote.quoteTime)) : null,
          conflicts: [], raw: [raw],
        };
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }
}
