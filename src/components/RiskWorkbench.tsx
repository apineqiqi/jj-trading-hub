import { Calculator, Crosshair, Gauge, Save, ShieldAlert, Trash2, TrendingUp, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Position, RiskPlan, RiskProfile, UserProfile, WatchItem } from '../types/market';

const defaultProfile = (userId: string): RiskProfile => ({ userId, singlePositionPct: 35, portfolioPct: 80, tradeRiskPct: 1, dailyLossPct: 2 });
const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function numbers(value?: string) {
  return (value?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function suggestedLevels(item?: WatchItem) {
  const entry = item?.price ?? 0;
  const stopCandidates = numbers(item?.invalidation).filter(value => value < entry);
  const targetCandidates = numbers(item?.trigger).filter(value => value > entry);
  const stop = stopCandidates.length ? Math.min(...stopCandidates) : entry * .95;
  const target = targetCandidates.length ? Math.max(...targetCandidates) : entry * 1.1;
  return { entry: entry.toFixed(2), stop: stop.toFixed(2), target: target.toFixed(2) };
}

export function RiskWorkbench({ users, selectedUserId, positions, watchlist, cashByUser, profiles, plans, hidden, onProfileChange, onAddPlan, onDeletePlan }: {
  users: UserProfile[];
  selectedUserId: string;
  positions: Position[];
  watchlist: WatchItem[];
  cashByUser: Record<string, number>;
  profiles: RiskProfile[];
  plans: RiskPlan[];
  hidden: boolean;
  onProfileChange: (profile: RiskProfile) => void;
  onAddPlan: (plan: RiskPlan) => void;
  onDeletePlan: (plan: RiskPlan) => void;
}) {
  const activeUsers = users.filter(user => !user.archived);
  const initialUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? '' : selectedUserId;
  const [userId, setUserId] = useState(initialUserId);
  const formWatchlist = useMemo(() => watchlist.filter(item => item.userId === userId), [watchlist, userId]);
  const [symbol, setSymbol] = useState(formWatchlist[0]?.symbol ?? '');
  const [levels, setLevels] = useState(() => suggestedLevels(formWatchlist[0]));

  useEffect(() => setUserId(initialUserId), [initialUserId]);
  useEffect(() => {
    const item = formWatchlist[0];
    if (!item) return;
    setSymbol(item.symbol);
    setLevels(suggestedLevels(item));
  }, [userId]);

  const owner = activeUsers.find(user => user.id === userId);
  const profile = profiles.find(item => item.userId === userId) ?? defaultProfile(userId);
  const userPositions = positions.filter(item => item.userId === userId);
  const currentPortfolio = userPositions.reduce((sum, item) => sum + (item.reportedMarketValue ?? item.price * item.shares), 0);
  const cash = cashByUser[userId] ?? 0;
  const assets = currentPortfolio + cash;
  const selectedStock = formWatchlist.find(item => item.symbol === symbol);
  const existingPosition = userPositions.find(item => item.symbol === symbol);
  const existingValue = existingPosition ? existingPosition.reportedMarketValue ?? existingPosition.price * existingPosition.shares : 0;
  const entry = Number(levels.entry);
  const stop = Number(levels.stop);
  const target = Number(levels.target);
  const riskPerShare = Math.max(0, entry - stop);
  const rewardPerShare = Math.max(0, target - entry);
  const riskBudget = assets * profile.tradeRiskPct / 100;
  const dailyLossLimit = assets * profile.dailyLossPct / 100;
  const riskShares = riskPerShare ? Math.floor(riskBudget / riskPerShare) : 0;
  const singleCapacity = Math.max(0, assets * profile.singlePositionPct / 100 - existingValue);
  const portfolioCapacity = Math.max(0, assets * profile.portfolioPct / 100 - currentPortfolio);
  const capitalShares = entry ? Math.floor(Math.min(singleCapacity, portfolioCapacity) / entry) : 0;
  const suggestedShares = Math.max(0, Math.floor(Math.min(riskShares, capitalShares) / 100) * 100);
  const capital = suggestedShares * entry;
  const riskAmount = suggestedShares * riskPerShare;
  const rewardRiskRatio = riskPerShare ? rewardPerShare / riskPerShare : 0;
  const currentPortfolioPct = assets ? currentPortfolio / assets * 100 : 0;
  const capitalPct = assets ? capital / assets * 100 : 0;
  const afterPortfolioPct = assets ? (currentPortfolio + capital) / assets * 100 : 0;
  const afterSinglePct = assets ? (existingValue + capital) / assets * 100 : 0;
  const userPlans = plans.filter(item => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cashKnown = cashByUser[userId] !== undefined;
  const hasValidLevels = Boolean(selectedStock && cashKnown && assets > 0 && stop > 0 && entry > stop && target > entry && suggestedShares > 0);
  const privateMoney = (value: number) => hidden ? '••••••' : `¥${money.format(value)}`;
  const warnings = [
    !cashKnown ? '请先在资金与备份中录入该账户现金' : '',
    assets <= 0 ? '该账户尚无可计算资产' : '',
    entry <= stop ? '入场价必须高于止损价' : '',
    target <= entry ? '目标价必须高于入场价' : '',
    suggestedShares === 0 && assets > 0 ? '当前风险或仓位余量不足 100 股' : '',
    rewardRiskRatio > 0 && rewardRiskRatio < 2 ? '计划盈亏比低于 2:1' : ''
  ].filter(Boolean);

  const updateProfile = (key: keyof Omit<RiskProfile, 'userId'>, value: number) => onProfileChange({ ...profile, [key]: value });
  const chooseStock = (nextSymbol: string) => {
    setSymbol(nextSymbol);
    setLevels(suggestedLevels(formWatchlist.find(item => item.symbol === nextSymbol)));
  };
  const savePlan = () => {
    if (!selectedStock || !hasValidLevels) return;
    onAddPlan({
      id: crypto.randomUUID(), userId, symbol: selectedStock.symbol, name: selectedStock.name,
      entry, stop, target, shares: suggestedShares, riskAmount, capital, rewardRiskRatio,
      createdAt: new Date().toISOString()
    });
  };

  return <section className="risk-page">
    <section className="risk-hero">
      <div><span className="eyebrow">CAPITAL DEFENSE SYSTEM · V1.0</span><h2>先定义最多亏多少，再决定可以买多少</h2><p>建议股数同时受单笔风险、单股上限和组合仓位约束。这里输出的是风险预算，不替代对行情方向的判断。</p></div>
      <div className="risk-hero-state"><span>账户净资产</span><strong>{privateMoney(assets)}</strong><small>{owner?.name ?? '未选择账户'} · 当前仓位 {hidden ? '••••' : `${currentPortfolioPct.toFixed(1)}%`}</small></div>
    </section>

    <div className="risk-layout">
      <section className="risk-calculator card">
        <div className="risk-card-head"><div><span className="eyebrow">POSITION SIZER</span><h3><Calculator size={19}/>仓位计算器</h3></div><span className={hasValidLevels ? 'risk-ready' : 'risk-wait'}>{hasValidLevels ? '参数有效' : '等待完整参数'}</span></div>
        <div className="risk-input-grid">
          <label><span>账户</span><select value={userId} onChange={event => setUserId(event.target.value)}>{activeUsers.map(user => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
          <label><span>观察标的</span><select value={symbol} onChange={event => chooseStock(event.target.value)}>{formWatchlist.map(item => <option value={item.symbol} key={`${item.userId}-${item.symbol}`}>{item.name} · {item.symbol}</option>)}</select></label>
          <label><span>计划入场价</span><input value={levels.entry} type="number" min="0" step="0.01" onChange={event => setLevels(current => ({ ...current, entry: event.target.value }))}/></label>
          <label><span>止损价</span><input value={levels.stop} type="number" min="0" step="0.01" onChange={event => setLevels(current => ({ ...current, stop: event.target.value }))}/></label>
          <label><span>目标价</span><input value={levels.target} type="number" min="0" step="0.01" onChange={event => setLevels(current => ({ ...current, target: event.target.value }))}/></label>
        </div>

        <div className="risk-equation"><span>{privateMoney(riskBudget)} 单笔风险</span><i>÷</i><span>{privateMoney(riskPerShare)} 每股风险</span><i>=</i><strong>{hidden ? '••••' : suggestedShares.toLocaleString('zh-CN')} 股</strong></div>

        <div className="risk-output-grid">
          <div className="risk-primary-output"><span>建议新增数量</span><strong>{hidden ? '••••' : suggestedShares.toLocaleString('zh-CN')}<small>股</small></strong><p>已按 100 股一手向下取整</p></div>
          <div><span>预计占用资金</span><b>{privateMoney(capital)}</b><small>新增仓位 {hidden ? '••••' : `${capitalPct.toFixed(1)}%`}</small></div>
          <div><span>计划最大亏损</span><b className="down">{privateMoney(riskAmount)}</b><small>预算使用 {riskBudget ? (riskAmount / riskBudget * 100).toFixed(0) : 0}%</small></div>
          <div><span>计划盈亏比</span><b className={rewardRiskRatio >= 2 ? 'up' : 'warn'}>{rewardRiskRatio ? `${rewardRiskRatio.toFixed(2)} : 1` : '—'}</b><small>纪律线 ≥ 2 : 1</small></div>
        </div>

        <div className="risk-capacity">
          <div><span>单股仓位（计划后）</span><b>{hidden ? '••••' : `${afterSinglePct.toFixed(1)}%`} / {profile.singlePositionPct}%</b><i><em style={{ width: `${Math.min(100, afterSinglePct / Math.max(profile.singlePositionPct, 1) * 100)}%` }}/></i></div>
          <div><span>组合仓位（计划后）</span><b>{hidden ? '••••' : `${afterPortfolioPct.toFixed(1)}%`} / {profile.portfolioPct}%</b><i><em style={{ width: `${Math.min(100, afterPortfolioPct / Math.max(profile.portfolioPct, 1) * 100)}%` }}/></i></div>
        </div>

        {warnings.length > 0 && <div className="risk-warnings">{warnings.map(item => <span key={item}><ShieldAlert size={13}/>{item}</span>)}</div>}
        <div className="risk-save-row"><span>现有持仓：{hidden ? '••••' : `${existingPosition?.shares ?? 0} 股`} · 可用组合余量 {privateMoney(portfolioCapacity)}</span><button className="primary-btn" disabled={!hasValidLevels} onClick={savePlan}><Save size={15}/>保存交易计划</button></div>
      </section>

      <aside className="risk-sidebar">
        <section className="card risk-policy">
          <div className="section-title"><Gauge size={17}/>风险纪律</div>
          <p>每个账户独立保存；调整后立即参与仓位计算。</p>
          <label><span>单股仓位上限</span><div><input type="number" min="1" max="100" step="1" value={profile.singlePositionPct} onChange={event => updateProfile('singlePositionPct', Number(event.target.value))}/><em>%</em></div></label>
          <label><span>组合仓位上限</span><div><input type="number" min="1" max="100" step="1" value={profile.portfolioPct} onChange={event => updateProfile('portfolioPct', Number(event.target.value))}/><em>%</em></div></label>
          <label><span>单笔风险上限</span><div><input type="number" min="0.1" max="10" step="0.1" value={profile.tradeRiskPct} onChange={event => updateProfile('tradeRiskPct', Number(event.target.value))}/><em>%</em></div></label>
          <label><span>单日亏损上限</span><div><input type="number" min="0.1" max="20" step="0.1" value={profile.dailyLossPct} onChange={event => updateProfile('dailyLossPct', Number(event.target.value))}/><em>%</em></div></label>
        </section>
        <section className="card loss-circuit"><Crosshair size={24}/><span>今日熔断线</span><strong>{privateMoney(dailyLossLimit)}</strong><p>达到后停止新增主动风险，优先复核执行偏差。</p></section>
      </aside>
    </div>

    <section className="risk-plans card">
      <div className="section-heading"><div><div className="section-title"><WalletCards size={18}/>已保存计划</div><span className="section-meta">{owner?.name ?? '当前账户'} · 仅保存计算参数，不自动下单</span></div><span className="plan-count">{userPlans.length} PLANS</span></div>
      {userPlans.length ? <div className="plan-list">{userPlans.map(plan => <article key={plan.id}>
        <div className="plan-symbol"><TrendingUp size={17}/><span><b>{hidden ? '计划标的' : plan.name}</b><small>{hidden ? '••••••' : plan.symbol}</small></span></div>
        <div><span>入场 / 止损 / 目标</span><b>{hidden ? '••••••' : `${plan.entry.toFixed(2)} / ${plan.stop.toFixed(2)} / ${plan.target.toFixed(2)}`}</b></div>
        <div><span>数量 / 占用</span><b>{hidden ? '••••••' : `${plan.shares} 股 / ¥${money.format(plan.capital)}`}</b></div>
        <div><span>最大亏损 / 盈亏比</span><b>{hidden ? '••••••' : `¥${money.format(plan.riskAmount)} / ${plan.rewardRiskRatio.toFixed(2)}:1`}</b></div>
        <button className="tiny-btn danger" title={`删除 ${plan.name} 计划`} onClick={() => onDeletePlan(plan)}><Trash2 size={14}/></button>
      </article>)}</div> : <div className="plan-empty"><Crosshair size={27}/><b>还没有保存交易计划</b><span>把价格边界填写完整后，保存第一份可复核的风险预算。</span></div>}
    </section>
  </section>;
}
