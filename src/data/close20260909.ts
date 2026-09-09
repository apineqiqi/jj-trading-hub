import type { AccountSnapshot, DecisionRule, PortfolioSnapshot, Position, TradeRecord, WatchItem } from '../types/market';

// Source: 周一开盘决策表, 2026-09-09 close; IMG_2735/2736 and confirmed conversation.
export const closeAccount: AccountSnapshot = {
  asOf: '2026-09-09 收盘', totalAssets: 1100467.22, marketValue: 966574,
  availableCash: 133893.22, unrealizedPnl: 114431.24, positionPct: 87.8,
};
export const closePositions: Position[] = [
  { id: 'jj-688167', userId: 'user-jj', owner: 'JJ', symbol: '688167', name: '炬光科技', shares: 1800,
    cost: 256.091, price: 302.55, reportedMarketValue: 544590, reportedPnl: 83572.26, reportedReturnPct: 18.141 },
  { id: 'jj-688256', userId: 'user-jj', owner: 'JJ', symbol: '688256', name: '寒武纪', shares: 400,
    cost: 977.765, price: 1054.96, reportedMarketValue: 421984, reportedPnl: 30858.98, reportedReturnPct: 7.895 },
];
export const closeSnapshot: PortfolioSnapshot = {
  id: 'snapshot-jj-2026-09-09', userId: 'user-jj', date: '2026-09-09',
  totalAssets: closeAccount.totalAssets, marketValue: closeAccount.marketValue,
  cash: closeAccount.availableCash, unrealizedPnl: closeAccount.unrealizedPnl,
  note: '2026-09-09 收盘持仓截图 IMG_2735；券商显示成本和盈亏口径，非卖出实现收益。',
};
export const closeTrade: TradeRecord = {
  id: 'trade-jj-2026-09-09-688167-sell-400', userId: 'user-jj', date: '2026-09-09',
  side: '卖出', symbol: '688167', name: '炬光科技', shares: 400, price: 316.045,
  note: '计划内波段减仓：均价316.045元减400股，剩余1800股。来源：当日成交截图 IMG_2736。费用、逐笔成交时间及实际触发路径未确认；不以收盘结果倒推盘中复合条件已全部满足。不机械回补。',
};
export const closeWatch: Record<string, Pick<WatchItem, 'state' | 'support' | 'trigger' | 'invalidation' | 'note'>> = {
  '688167': { state: '防守', support: '300–303；下一防守区289–292',
    trigger: '重新站稳307–310；314–316压力；318–320强压力/突破确认',
    invalidation: '有效跌破300且反抽303失败',
    note: '2026-09-09收盘302.55：从修复转为修复失败后的防守。先守300–303，再收复307–310，再观察314–316和318–320。评分沿用历史值，未重新确认。' },
  '688256': { state: '等待确认', support: '1035–1050主支撑观察区；下一级995–1015',
    trigger: '重新站稳1070，确认修复', invalidation: '跌破1035且无法收回，转看995–1015',
    note: '2026-09-09低点1045.99、收盘1054.96：第一次主支撑测试初步通过，尚未确认反转。结合动态MA250及国产GPU相对强弱；MA250精确数值待确认。评分沿用历史值。' },
};
export const closeDecisions: DecisionRule[] = [
  { id: 'jg-framework', stock: '炬光科技', condition: '核心底仓与波段仓分层管理', action: '核心底仓计划占炬光仓位60%–70%，波段仓30%–40%；实际拆分待确认。普通日内波动不轻易调整核心底仓。', priority: '高' },
  { id: 'jg-defense', stock: '炬光科技', condition: '300–303出现明显承接，且CPO没有进一步退潮', action: '进入已减出400股的回补观察，不因触价机械买回；每档回补比例待确认。', priority: '高' },
  { id: 'jg-repair', stock: '炬光科技', condition: '重新站上并保持307–310，且CPO核心未明显转弱', action: '仅确认修复，不急于补满；再次跌回307以下且无法收复则修复失效。', priority: '高' },
  { id: 'jg-strength', stock: '炬光科技', condition: '站稳314–316，且中际旭创/新易盛/天孚通信至少两只保持明显强势', action: '再观察318–320突破；快速跌回314且板块转弱则确认失效，不追涨。', priority: '高' },
  { id: 'jg-reduce', stock: '炬光科技', condition: '进入318–320，且易中天至少两只冲高回落/明显转弱，或炬光自身出现放量冲高回落、长上影、跌回315以下等转弱信号', action: '进入波段减仓观察，原讨论约10%总仓；不清空核心底仓。若CPO同步强势且炬光放量站稳320，则暂缓减仓。比例口径执行前复核。', priority: '高' },
  { id: 'jg-rebound', stock: '炬光科技', condition: '首次冲击318–320失败→回落307–310→反抽314–316仍受阻，且板块同步降温', action: '反抽可作为波段减仓窗口，不必机械等待再次到318；原讨论5%–10%总仓。重新突破318并站稳320且板块转强则取消该条件。', priority: '高' },
  { id: 'jg-hot', stock: '炬光科技', condition: '进入320–325，且板块明显过热或冲高兑现', action: '保留原累计波段减仓15%–20%总仓框架；放量站稳320且CPO强共振则暂缓。与本次减出原持股约18.2%不是同一分母，不直接换算股数。', priority: '中' },
  { id: 'jg-fail', stock: '炬光科技', condition: '300有效失守且反抽303失败', action: '保留现金，停止机械回补，等待289–292重新评估；不急于把减仓现金转入寒武纪。', priority: '高' },
  { id: 'cam-support', stock: '寒武纪', condition: '1035–1050支撑带内企稳，跌破后快速收回，且摩尔线程/沐曦不再加速下杀', action: '观察第二次支撑验证，结合当日MA250实际位置；不触价即买，不一次打满；首笔比例与总仓上限待确认。现有400股保持。', priority: '高' },
  { id: 'cam-repair', stock: '寒武纪', condition: '重新站稳1070', action: '确认第一修复；收盘1054.96尚未满足，不将第一次支撑测试等同反转。', priority: '高' },
  { id: 'cam-fail', stock: '寒武纪', condition: '跌破1035且无法收回，或国产GPU继续加速杀跌', action: '停止机械加仓；支撑失效后观察995–1015。MA250精确值待确认。', priority: '高' },
];

export function appendCloseTrade(trades: TradeRecord[]): TradeRecord[] {
  const exists = trades.some(t => t.id === closeTrade.id || (t.userId === closeTrade.userId && t.date === closeTrade.date && t.symbol === closeTrade.symbol && t.side === closeTrade.side && t.shares === closeTrade.shares && t.price === closeTrade.price));
  return exists ? trades : [...trades, closeTrade];
}
