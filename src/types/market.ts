export type SignalState = '转强' | '观察' | '防守' | '等待确认';

export interface WatchItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  group: string;
  score: number;
  state: SignalState;
  support?: string;
  trigger?: string;
  invalidation?: string;
  note: string;
  quoteUpdatedAt?: string;
}

export interface DecisionRule {
  id: string;
  stock: string;
  condition: string;
  action: string;
  priority: '高' | '中' | '低';
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  owner?: string;
  shares: number;
  cost: number;
  price: number;
  reportedMarketValue?: number;
  reportedPnl?: number;
  reportedReturnPct?: number;
  quoteUpdatedAt?: string;
}

export interface AccountSnapshot {
  asOf: string;
  totalAssets: number;
  marketValue: number;
  availableCash: number;
  unrealizedPnl: number;
  positionPct: number;
}

export interface PortfolioSnapshot {
  id: string;
  date: string;
  totalAssets: number;
  marketValue: number;
  cash: number;
  unrealizedPnl: number;
  note?: string;
}

export type TradeSide = '买入' | '卖出';

export interface TradeRecord {
  id: string;
  date: string;
  side: TradeSide;
  symbol: string;
  name: string;
  shares: number;
  price: number;
  fee: number;
  note?: string;
}
