export type SignalState = '转强' | '观察' | '防守' | '等待确认';

export interface WatchItem {
  userId?: string;
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
  userId?: string;
  shares: number;
  cost: number;
  price: number;
  reportedMarketValue?: number;
  reportedPnl?: number;
  reportedReturnPct?: number;
  quoteUpdatedAt?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  color: string;
  archived?: boolean;
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
  userId?: string;
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
  userId?: string;
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

export type WorkflowPhase = 'pre' | 'live' | 'close';

export interface WorkflowTask {
  id: string;
  phase: WorkflowPhase;
  title: string;
  detail: string;
  sourceTitle?: string;
  importedAt?: string;
}

export interface DailyWorkflow {
  id: string;
  userId: string;
  date: string;
  checks: Record<string, boolean>;
  notes: Partial<Record<WorkflowPhase, string>>;
  customTasks?: WorkflowTask[];
  updatedAt: string;
}

export type AlertDirection = 'above' | 'below';

export interface PriceAlert {
  sourceTitle?: string;
  planId?: string;
  planLevel?: 'entry' | 'stop' | 'target';
  id: string;
  userId: string;
  symbol: string;
  name: string;
  direction: AlertDirection;
  target: number;
  label: string;
  enabled: boolean;
  acknowledged: boolean;
  createdAt: string;
}

export type VisualReviewMoment = 'pre' | 'live' | 'close';
export type VisualReviewBias = 'bullish' | 'neutral' | 'bearish';

export interface VisualReviewRecord {
  id: string;
  userId: string;
  date: string;
  symbol: string;
  name: string;
  moment: VisualReviewMoment;
  bias: VisualReviewBias;
  imageDataUrl: string;
  imageName: string;
  fact: string;
  judgment: string;
  nextCondition: string;
  createdAt: string;
}

export interface RiskProfile {
  userId: string;
  singlePositionPct: number;
  portfolioPct: number;
  tradeRiskPct: number;
  dailyLossPct: number;
}

export interface RiskPlan {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  entry: number;
  stop: number;
  target: number;
  shares: number;
  riskAmount: number;
  capital: number;
  rewardRiskRatio: number;
  createdAt: string;
}
