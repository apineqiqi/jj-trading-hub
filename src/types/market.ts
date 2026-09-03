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
}
