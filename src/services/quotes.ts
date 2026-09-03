export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  previousClose: number;
  updatedAt: string;
}

interface EastmoneyQuote {
  f2: number | '-';
  f3: number | '-';
  f12: string;
  f14: string;
  f18: number | '-';
  f124: number;
}

interface EastmoneyResponse {
  data?: { diff?: EastmoneyQuote[] };
}

const marketId = (symbol: string) => symbol.startsWith('6') ? '1' : '0';

export async function fetchMarketQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const uniqueSymbols = Array.from(new Set(symbols.filter(symbol => /^\d{6}$/.test(symbol))));
  if (!uniqueSymbols.length) return [];

  const secids = uniqueSymbols.map(symbol => `${marketId(symbol)}.${symbol}`).join(',');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${encodeURIComponent(secids)}&fields=f2,f3,f12,f14,f18,f124`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`行情服务返回 ${response.status}`);

    const payload = await response.json() as EastmoneyResponse;
    return (payload.data?.diff ?? []).flatMap(item => {
      if (typeof item.f2 !== 'number' || typeof item.f3 !== 'number' || typeof item.f18 !== 'number' || !Number.isFinite(item.f2) || item.f2 <= 0) return [];
      return [{
        symbol: item.f12,
        name: item.f14,
        price: item.f2 / 100,
        changePct: item.f3 / 100,
        previousClose: item.f18 / 100,
        updatedAt: new Date(item.f124 * 1000).toISOString()
      }];
    });
  } finally {
    window.clearTimeout(timeout);
  }
}
