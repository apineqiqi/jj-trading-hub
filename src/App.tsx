import { Activity, BellRing, BriefcaseBusiness, ChartNoAxesCombined, Eye, EyeOff, Gauge, LayoutDashboard, LibraryBig, ListChecks, ListFilter, ShieldAlert, ShieldCheck, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeAccount, closePositions, closeSnapshot, closeTrade, closeWatch, closeDecisions, appendCloseTrade } from './data/close20260909';
import { AlertCenter } from './components/AlertCenter';
import { DataManager } from './components/DataManager';
import { StrategyImporter } from './components/StrategyImporter';
import { StrategyCenter } from './components/StrategyCenter';
import { prepareStrategy, persistStrategy } from './data/strategyImport';
import { createStrategyRecord } from './data/strategyRecords';
import { DecisionTable } from './components/DecisionTable';
import { EditorModal } from './components/EditorModal';
import { MarketPulse, type QuoteStatus } from './components/MarketPulse';
import { PortfolioTable } from './components/PortfolioTable';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { RiskWorkbench } from './components/RiskWorkbench';
import { StatCard } from './components/StatCard';
import { TradingWorkflow } from './components/TradingWorkflow';
import { UserManagerModal } from './components/UserManagerModal';
import { UserSwitcher } from './components/UserSwitcher';
import { VisualReviewBoard } from './components/VisualReviewBoard';
import { WatchTable } from './components/WatchTable';
import { accountSnapshot, decisions, initialPositions, initialSnapshots, watchlist as initialWatchlist } from './data/mock';
import { seedAlertRules } from './data/alerts';
import { createPlanAlerts, linkedToPlan } from './data/planAlerts';
import { defaultUser, migratePositions, migrateUsers, migrateWatchlist } from './data/migration';
import { usePersistentState, useSaveStatus } from './hooks/usePersistentState';
import { fetchMarketQuotes } from './services/quotes';
import type { DailyWorkflow, PortfolioSnapshot, Position, PriceAlert, RiskPlan, RiskProfile, TradeRecord, UserProfile, VisualReviewRecord, WatchItem } from './types/market';
import type { StrategyRecord } from './types/strategy';

type View = 'overview' | 'workflow' | 'strategies' | 'portfolio' | 'watchlist' | 'risk' | 'review';
type EditorTarget = { kind: 'position'; value?: Position } | { kind: 'watch'; value?: WatchItem };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const saveStatus = useSaveStatus();
  const [dataOpen, setDataOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategyResult, setStrategyResult] = useState('');
  const [focusedStrategyId, setFocusedStrategyId] = useState('');
  const [cashByUser, setCashByUser] = usePersistentState<Record<string, number>>('jj-trading-v12-cash', { [defaultUser.id]: accountSnapshot.availableCash });
  const [users, setUsers] = usePersistentState<UserProfile[]>('jj-trading-v06-users', migrateUsers());
  const [activeUserId, setActiveUserId] = usePersistentState<string>('jj-trading-v06-active-user', 'all');
  const [positions, setPositions] = usePersistentState<Position[]>('jj-trading-v06-positions', migratePositions());
  const [watchlist, setWatchlist] = usePersistentState<WatchItem[]>('jj-trading-v06-watchlist', migrateWatchlist());
  const [snapshots, setSnapshots] = usePersistentState<PortfolioSnapshot[]>('jj-trading-v04-snapshots', initialSnapshots);
  const [trades, setTrades] = usePersistentState<TradeRecord[]>('jj-trading-v04-trades', [closeTrade]);
  const [privacyMode, setPrivacyMode] = usePersistentState<boolean>('jj-trading-privacy-mode', false);
  const [workflows, setWorkflows] = usePersistentState<DailyWorkflow[]>('jj-trading-v07-workflows', []);
  const [alerts, setAlerts] = usePersistentState<PriceAlert[]>('jj-trading-v08-alerts', seedAlertRules(migrateWatchlist()));
  const [visualReviews, setVisualReviews] = usePersistentState<VisualReviewRecord[]>('jj-trading-v09-visual-reviews', []);
  const [riskProfiles, setRiskProfiles] = usePersistentState<RiskProfile[]>('jj-trading-v10-risk-profiles', []);
  const [riskPlans, setRiskPlans] = usePersistentState<RiskPlan[]>('jj-trading-v10-risk-plans', []);
  const [strategies, setStrategies] = usePersistentState<StrategyRecord[]>('jj-trading-v16-strategies', []);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [managingUsers, setManagingUsers] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const notifiedAlerts = useRef(new Set<string>());
  const [quoteState, setQuoteState] = useState<{ status: QuoteStatus; updatedAt?: string; count: number; message?: string }>({ status: 'loading', count: 0 });

  const activeUsers = users.filter(user => !user.archived);
  const selectedUserId = activeUserId === 'all' || activeUsers.some(user => user.id === activeUserId) ? activeUserId : 'all';
  const scopedPositions = selectedUserId === 'all' ? positions : positions.filter(item => item.userId === selectedUserId);
  const scopedWatchlist = selectedUserId === 'all' ? watchlist : watchlist.filter(item => item.userId === selectedUserId);
  const activeProfile = users.find(user => user.id === selectedUserId);
  const editorUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? defaultUser.id : selectedUserId;
  const workflowUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? defaultUser.id : selectedUserId;
  const workflowOwner = users.find(user => user.id === workflowUserId)?.name ?? 'JJ';
  const workflowPositions = positions.filter(item => item.userId === workflowUserId);
  const workflowWatchlist = watchlist.filter(item => item.userId === workflowUserId);
  const today = new Date().toLocaleDateString('sv-SE');
  const workflow: DailyWorkflow = workflows.find(item => item.userId === workflowUserId && item.date === today) ?? { id: `${workflowUserId}-${today}`, userId: workflowUserId, date: today, checks: {}, notes: {}, updatedAt: new Date().toISOString() };

  const trackedSymbols = useMemo(() => Array.from(new Set([...positions, ...watchlist].map(item => item.symbol))).sort().join(','), [positions, watchlist]);
  const refreshQuotes = useCallback(async () => {
    setQuoteState(current => ({ ...current, status: 'loading', message: undefined }));
    try {
      const quotes = await fetchMarketQuotes(trackedSymbols.split(','));
      if (!quotes.length) throw new Error('未返回有效行情');
      const bySymbol = new Map(quotes.map(quote => [quote.symbol, quote]));
      setPositions(current => current.map(item => {
        const quote = bySymbol.get(item.symbol);
        return quote ? { ...item, price: quote.price, reportedMarketValue: undefined, reportedPnl: undefined, reportedReturnPct: undefined, quoteUpdatedAt: quote.updatedAt } : item;
      }));
      setWatchlist(current => current.map(item => {
        const quote = bySymbol.get(item.symbol);
        return quote ? { ...item, price: quote.price, changePct: quote.changePct, quoteUpdatedAt: quote.updatedAt } : item;
      }));
      const updatedAt = quotes.reduce((latest, quote) => quote.updatedAt > latest ? quote.updatedAt : latest, quotes[0].updatedAt);
      setQuoteState({ status: 'success', updatedAt, count: quotes.length });
    } catch (error) {
      setQuoteState(current => ({ ...current, status: 'error', message: error instanceof Error ? error.message : '请稍后重试' }));
    }
  }, [trackedSymbols, setPositions, setWatchlist]);

  useEffect(() => {
    void refreshQuotes();
    const timer = window.setInterval(() => void refreshQuotes(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshQuotes]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const prices = new Map(watchlist.map(item => [`${item.userId ?? defaultUser.id}-${item.symbol}`, item.price]));
    const active = new Set<string>();
    alerts.forEach(rule => {
      const price = prices.get(`${rule.userId}-${rule.symbol}`);
      const hit = price !== undefined && rule.enabled && (rule.direction === 'above' ? price >= rule.target : price <= rule.target);
      if (!hit) return;
      active.add(rule.id);
      if (!rule.acknowledged && !notifiedAlerts.current.has(rule.id)) {
        new Notification(`JJ 交易中枢 · ${rule.name}`, { body: `${rule.label}｜现价 ${price.toFixed(2)}，目标 ${rule.target.toFixed(2)}` });
        notifiedAlerts.current.add(rule.id);
      }
    });
    notifiedAlerts.current.forEach(id => { if (!active.has(id)) notifiedAlerts.current.delete(id); });
  }, [alerts, watchlist]);

  const portfolio = useMemo(() => scopedPositions.reduce((total, item) => total + (item.reportedMarketValue ?? item.price * item.shares), 0), [scopedPositions]);
  const pnl = useMemo(() => scopedPositions.reduce((total, item) => total + (item.reportedPnl ?? (item.price - item.cost) * item.shares), 0), [scopedPositions]);
  const scopedCash = selectedUserId === 'all' ? Object.values(cashByUser).reduce((sum, cash) => sum + cash, 0) : cashByUser[selectedUserId] ?? 0;
  const cashKnown = selectedUserId === 'all' ? users.every(user => cashByUser[user.id] !== undefined) : cashByUser[selectedUserId] !== undefined;
  const scopedSnapshots = snapshots.filter(item => item.userId !== undefined && (selectedUserId === 'all' || item.userId === selectedUserId));
  const scopedTrades = trades.filter(item => item.userId !== undefined && (selectedUserId === 'all' || item.userId === selectedUserId));
  const totalAssets = portfolio + scopedCash;
  const positionPct = totalAssets ? portfolio / totalAssets * 100 : 0;
  const attackSignals = scopedWatchlist.filter(item => item.state === '转强').length;
  const alertPrices = new Map(watchlist.map(item => [`${item.userId ?? defaultUser.id}-${item.symbol}`, item.price]));
  const visibleAlerts = selectedUserId === 'all' ? alerts : alerts.filter(rule => rule.userId === selectedUserId);
  const visibleRiskPlans = selectedUserId === 'all' ? riskPlans : riskPlans.filter(plan => plan.userId === selectedUserId);
  const triggeredAlerts = visibleAlerts.filter(rule => {
    const price = alertPrices.get(`${rule.userId}-${rule.symbol}`);
    return price !== undefined && rule.enabled && !rule.acknowledged && (rule.direction === 'above' ? price >= rule.target : price <= rule.target);
  }).length;
  const workflowPortfolio = workflowPositions.reduce((total, item) => total + (item.reportedMarketValue ?? item.price * item.shares), 0);
  const workflowCash = cashByUser[workflowUserId] ?? 0;
  const workflowPositionPct = workflowPortfolio + workflowCash ? workflowPortfolio / (workflowPortfolio + workflowCash) * 100 : 0;
  const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const privateValue = (value: string) => privacyMode ? '••••••' : value;
  const backupData = {
    'jj-trading-v06-users': users, 'jj-trading-v06-active-user': activeUserId,
    'jj-trading-v06-positions': positions, 'jj-trading-v06-watchlist': watchlist,
    'jj-trading-v04-snapshots': snapshots, 'jj-trading-v04-trades': trades,
    'jj-trading-privacy-mode': privacyMode, 'jj-trading-v07-workflows': workflows,
    'jj-trading-v08-alerts': alerts, 'jj-trading-v09-visual-reviews': visualReviews,
    'jj-trading-v10-risk-profiles': riskProfiles, 'jj-trading-v10-risk-plans': riskPlans,
    'jj-trading-v12-cash': cashByUser,
    'jj-trading-v16-strategies': strategies,
  };
  const workflowTaskTotal = 12 + (workflow.customTasks?.length ?? 0);
  const workflowTaskIds = new Set(workflow.customTasks?.map(item => item.id) ?? []);
  const workflowCompleted = Object.entries(workflow.checks).filter(([id, done]) => done && (!id.startsWith('chat-') || workflowTaskIds.has(id))).length;
  const disciplineProfile = riskProfiles.find(item => item.userId === workflowUserId) ?? { userId: workflowUserId, singlePositionPct: 35, portfolioPct: 80, tradeRiskPct: 1, dailyLossPct: 2 };
  const saveWorkflow = (next: DailyWorkflow) => setWorkflows(current => current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [...current, next]);

  const saveEditor = (value: Position | WatchItem) => {
    if (editor?.kind === 'position') {
      const position = value as Position;
      setPositions(current => current.some(item => item.id === position.id) ? current.map(item => item.id === position.id ? position : item) : [...current, position]);
    } else {
      const watch = value as WatchItem;
      const previous = editor?.value as WatchItem | undefined;
      setWatchlist(current => previous ? current.map(item => item.symbol === previous.symbol && item.userId === previous.userId ? watch : item) : [...current, watch]);
    }
    setEditor(null);
  };

  const removePosition = (item: Position) => window.confirm(`删除 ${item.name} 的持仓记录？`) && setPositions(current => current.filter(x => x.id !== item.id));
  const removeWatch = (item: WatchItem) => window.confirm(`从观察池移除 ${item.name}？`) && setWatchlist(current => current.filter(x => !(x.symbol === item.symbol && x.userId === item.userId)));
  const removeSnapshot = (item: PortfolioSnapshot) => window.confirm(`删除 ${item.date} 的账户快照？`) && setSnapshots(current => current.filter(x => x.id !== item.id));
  const removeTrade = (item: TradeRecord) => window.confirm(`删除 ${item.date} ${item.name} 的交易记录？`) && setTrades(current => current.filter(x => x.id !== item.id));
  const removeVisualReview = (item: VisualReviewRecord) => window.confirm(`删除 ${item.date} ${item.name} 的盘面证据？`) && setVisualReviews(current => current.filter(x => x.id !== item.id));
  const removeRiskPlan = (item: RiskPlan) => {
    const count = alerts.filter(alert => linkedToPlan(alert, item)).length;
    if (!window.confirm(`删除 ${item.name} 的交易计划及其 ${count} 条关联提醒？手动提醒不受影响。`)) return;
    setAlerts(current => current.filter(alert => !linkedToPlan(alert, item)));
    setRiskPlans(current => current.filter(x => x.id !== item.id));
  };
  const saveRiskProfile = (profile: RiskProfile) => setRiskProfiles(current => current.some(item => item.userId === profile.userId) ? current.map(item => item.userId === profile.userId ? profile : item) : [...current, profile]);

  const addUser = (name: string, color: string) => {
    const user = { id: crypto.randomUUID(), name, color };
    setUsers(current => [...current, user]);
    setActiveUserId(user.id);
  };
  const updateUser = (user: UserProfile) => {
    setUsers(current => current.map(item => item.id === user.id ? user : item));
    setPositions(current => current.map(item => item.userId === user.id ? { ...item, owner: user.name } : item));
  };
  const toggleArchive = (user: UserProfile) => {
    setUsers(current => current.map(item => item.id === user.id ? { ...item, archived: !item.archived } : item));
    if (!user.archived && selectedUserId === user.id) setActiveUserId('all');
  };

  return <div className="app-shell">
    <header>
      <div><div className="brand-line"><span className="eyebrow">JJ PERSONAL TRADING OS</span><span className="version-badge">V1.6</span></div><h1>JJ 交易中枢</h1></div>
      <div className="header-actions"><UserSwitcher users={users} value={selectedUserId} onChange={setActiveUserId} onManage={() => setManagingUsers(true)}/><button className={`privacy-toggle ${privacyMode ? 'active' : ''}`} aria-pressed={privacyMode} onClick={() => setPrivacyMode(value => !value)}>{privacyMode ? <Eye size={17}/> : <EyeOff size={17}/>}<span>{privacyMode ? '显示持仓' : '隐藏持仓'}</span></button><button className={`icon-btn alert-trigger ${triggeredAlerts ? 'hot' : ''}`} title="条件提醒" onClick={() => setAlertsOpen(true)}><BellRing size={20}/>{triggeredAlerts > 0 && <span>{triggeredAlerts}</span>}</button></div>
    </header>

    <nav className="workspace-nav" aria-label="工作区">
      <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={16}/>总览</button>
      <button className={view === 'workflow' ? 'active' : ''} onClick={() => setView('workflow')}><ListChecks size={16}/>交易日 <span>{workflowCompleted}/{workflowTaskTotal}</span></button>
      <button className={view === 'strategies' ? 'active' : ''} onClick={() => { setFocusedStrategyId(''); setView('strategies'); }}><LibraryBig size={16}/>策略中心 <span>{selectedUserId === 'all' ? strategies.length : strategies.filter(item => item.userId === selectedUserId).length}</span></button>
      <button className={view === 'portfolio' ? 'active' : ''} onClick={() => setView('portfolio')}><BriefcaseBusiness size={16}/>持仓 <span>{scopedPositions.length}</span></button>
      <button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}><ListFilter size={16}/>观察池 <span>{scopedWatchlist.length}</span></button>
      <button className={view === 'risk' ? 'active' : ''} onClick={() => setView('risk')}><ShieldAlert size={16}/>风控 <span>{visibleRiskPlans.length}</span></button>
      <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><ChartNoAxesCombined size={16}/>复盘 <span>{scopedSnapshots.length + visualReviews.filter(item => selectedUserId === 'all' || item.userId === selectedUserId).length}</span></button>
      <button onClick={() => setDataOpen(true)}>资金与备份</button>
      <div className={`save-state ${saveStatus.startsWith('保存失败') ? 'save-error' : ''}`} role="status"><i></i>{saveStatus}</div>
    </nav>

    <MarketPulse {...quoteState} onRefresh={() => void refreshQuotes()}/>

    <main>
      {(selectedUserId === 'all' || selectedUserId === 'user-jj') && <section className="card">
        <h2>2026-09-09 收盘更新 · JJ</h2>
        <p>{privacyMode ? '持仓与成交信息已隐藏' : '炬光科技均价316.045元减400股，剩1800股；寒武纪400股。炬光从修复转为防守，寒武纪首次主支撑测试初步通过。'}</p>
        <p>策略固定于9月9日收盘，不随实时行情变化。已有浏览器数据可用下方按钮同步；这会把JJ两只持仓、现金和观察条件恢复到该日收盘，请勿覆盖后续交易。</p>
        <button className="ghost-btn" disabled={!users.some(u => u.id === 'user-jj' && !u.archived)} onClick={() => {
          setPositions(current => [...current.filter(p => !(p.userId === 'user-jj' && closePositions.some(c => c.symbol === p.symbol))), ...closePositions]);
          setCashByUser(current => ({ ...current, 'user-jj': closeAccount.availableCash }));
          setWatchlist(current => current.map(w => w.userId === 'user-jj' && closeWatch[w.symbol] ? { ...w, ...closeWatch[w.symbol] } : w));
          setTrades(appendCloseTrade);
          setSnapshots(current => current.some(x => x.id === closeSnapshot.id || (x.userId === 'user-jj' && x.date === closeSnapshot.date)) ? current : [...current, closeSnapshot]);
        }}>同步9月9日收盘记录到本机JJ账户</button>
        {!privacyMode && <details><summary>9月9日收盘策略与复合条件</summary><DecisionTable rows={closeDecisions}/></details>}
      </section>}
      {view === 'overview' && <>
        <section className="account-scope"><span style={{ background: activeProfile?.color ?? '#f2b84b' }}></span><UsersRound size={15}/><b>{activeProfile?.name ?? '全账户'}</b><small>{activeProfile ? '独立用户视角' : `${activeUsers.length} 位用户的合并视角`}</small></section>
        <button className="workflow-launch" onClick={() => setView('workflow')}>
          <span className="workflow-launch-icon"><ListChecks size={19}/></span><span><small>今日交易流程 · {workflowOwner}</small><b>{workflowCompleted === workflowTaskTotal ? '今日流程已完成' : `还有 ${workflowTaskTotal - workflowCompleted} 项待确认`}</b></span><span className="workflow-launch-progress"><i style={{ width: `${workflowCompleted / workflowTaskTotal * 100}%` }}/></span><em>{workflowCompleted}/{workflowTaskTotal}</em><span className="workflow-launch-cta">继续 <span>→</span></span>
        </button>
        <section className="hero card">
          <div><span className="eyebrow">历史参考 · 2026-09-03 收盘</span><h2>设备 / 测试 / 激光强于光模块核心</h2><p>此判断来自历史样例，不随行情刷新更新。请在当日交易流程中记录新的判断和执行条件。</p></div>
          <div className="hero-score"><span>历史环境</span><strong>分化</strong></div>
        </section>
        <section className="stats">
          <StatCard title="总资产" value={cashKnown ? privateValue(money(totalAssets)) : '待补现金'} sub={cashKnown ? '持仓估值 + 已录现金' : '请在资金与备份中补齐现金'} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="持仓市值" value={privateValue(money(portfolio))} sub={`${scopedPositions.length} 个持仓`} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="可用现金" value={cashKnown ? privateValue(money(scopedCash)) : '待补现金'} sub="资金与备份中维护余额" icon={<Activity size={18}/>}/>
          <StatCard title="浮动盈亏" value={privateValue(`${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}`)} sub={quoteState.status === 'success' ? '行情估算口径' : '券商账户口径'} icon={<Activity size={18}/>}/>
          <StatCard title="当前仓位" value={cashKnown ? privateValue(`${positionPct.toFixed(1)}%`) : '—'} sub="持仓市值 / 总资产" icon={<Gauge size={18}/>}/>
          <StatCard title="进攻信号" value={String(attackSignals)} sub={attackSignals ? '观察池出现转强' : '暂无转强标的'} icon={<Gauge size={18}/>}/>
        </section>
        <PortfolioTable items={scopedPositions} users={users} showOwners={selectedUserId === 'all'} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
        <p className="section-meta">以下为2026-09-03收盘的历史决策参考，不代表今日计划。</p><DecisionTable rows={decisions}/>
      </>}

      {view === 'portfolio' && <>
        <section className="view-intro"><span className="eyebrow">PORTFOLIO LEDGER · {activeProfile?.name ?? 'ALL ACCOUNTS'}</span><h2>持仓与成本</h2><p>用户数据彼此隔离；全账户视角用于统一查看风险与资金分布。</p></section>
        <PortfolioTable items={scopedPositions} users={users} showOwners={selectedUserId === 'all'} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
      </>}

      {view === 'watchlist' && <>
        <section className="view-intro"><span className="eyebrow">TACTICAL WATCHLIST</span><h2>观察池与交易边界</h2><p>持续维护状态、关键价位与失效条件，让盘中动作来自计划，而不是情绪。</p></section>
        <WatchTable items={scopedWatchlist} users={users} showOwners={selectedUserId === 'all'} onAdd={() => setEditor({ kind: 'watch' })} onEdit={value => setEditor({ kind: 'watch', value })} onDelete={removeWatch}/>
      </>}

      {view === 'workflow' && <>{strategyResult && <p className="strategy-result" role="status">{strategyResult}<button className="ghost-btn" onClick={() => setAlertsOpen(true)}>查看提醒中心</button></p>}<TradingWorkflow onImportStrategy={() => { setStrategyOpen(true); setStrategyResult(''); }} onOpenStrategy={id => { setFocusedStrategyId(id); setView('strategies'); }} record={workflow} ownerName={workflowOwner} positions={workflowPositions.length} attackSignals={workflowWatchlist.filter(item => item.state === '转强').length} positionPct={workflowPositionPct} cashKnown={cashByUser[workflowUserId] !== undefined} portfolioLimit={disciplineProfile.portfolioPct} hidden={privacyMode} onChange={saveWorkflow}/></>}

      {view === 'strategies' && <StrategyCenter strategies={strategies} users={users} selectedUserId={selectedUserId} workflows={workflows} alerts={alerts} focusedStrategyId={focusedStrategyId} onImport={() => { setStrategyOpen(true); setStrategyResult(''); }}/>}

      {view === 'risk' && <RiskWorkbench
        users={users}
        selectedUserId={selectedUserId}
        positions={positions}
        watchlist={watchlist}
        cashByUser={cashByUser}
        profiles={riskProfiles}
        plans={riskPlans}
        alerts={alerts}
        onOpenAlerts={() => setAlertsOpen(true)}
        onLinkAlerts={(plan, direction) => {
          if (!watchlist.some(item => item.userId === plan.userId && item.symbol === plan.symbol)) throw new Error('该标的已不在此账户观察池，请先重新添加后生成提醒');
          createPlanAlerts(plan, direction, alerts);
          setAlerts(current => [...current, ...createPlanAlerts(plan, direction, current)]);
        }}
        hidden={privacyMode}
        onProfileChange={saveRiskProfile}
        onAddPlan={item => setRiskPlans(current => [item, ...current])}
        onDeletePlan={removeRiskPlan}
      />}

      {view === 'review' && <ReviewWorkspace
        cashKnown={cashKnown}
        key={selectedUserId}
        users={users}
        selectedUserId={selectedUserId}
        legacySnapshots={snapshots.filter(item => !item.userId)}
        legacyTrades={trades.filter(item => !item.userId)}
        onAssignLegacy={(kind, id, userId) => kind === 'snapshot' ? setSnapshots(current => current.map(item => item.id === id ? { ...item, userId } : item)) : setTrades(current => current.map(item => item.id === id ? { ...item, userId } : item))}
        hidden={privacyMode}
        snapshots={scopedSnapshots}
        trades={scopedTrades}
        currentSnapshot={{ totalAssets, marketValue: portfolio, cash: scopedCash, unrealizedPnl: pnl }}
        evidencePanel={<VisualReviewBoard
          records={visualReviews}
          users={users}
          selectedUserId={selectedUserId}
          watchlist={watchlist}
          hidden={privacyMode}
          onAdd={item => setVisualReviews(current => [item, ...current])}
          onDelete={removeVisualReview}
        />}
        onAddSnapshot={item => setSnapshots(current => [...current, item])}
        onDeleteSnapshot={removeSnapshot}
        onAddTrade={item => setTrades(current => [...current, item])}
        onDeleteTrade={removeTrade}
      />}

      <section className="card checklist">
        <div className="section-title"><ShieldCheck size={18}/>执行纪律</div>
        <p>新仓必须同时具备：触发价、失效价、仓位动作。事实口径未确认时，只输出条件判断，不给确定性加减仓结论。</p>
        <div className="chips"><span>单股≤{disciplineProfile.singlePositionPct}%</span><span>组合≤{disciplineProfile.portfolioPct}%</span><span>单笔风险≤{disciplineProfile.tradeRiskPct}%</span><span>日亏损≤{disciplineProfile.dailyLossPct}%</span><span>计划盈亏比≥2</span></div>
      </section>
    </main>

    {editor && <EditorModal target={editor} users={activeUsers} defaultUserId={editorUserId} onClose={() => setEditor(null)} onSave={saveEditor}/>}
    {dataOpen && <DataManager users={users} cash={cashByUser} onCash={setCashByUser} data={backupData} onClose={() => setDataOpen(false)}/>}
    {strategyOpen && <StrategyImporter users={users} selectedUserId={selectedUserId} workflows={workflows} alerts={alerts} watchlist={watchlist} onClose={() => setStrategyOpen(false)} onImport={(pack, selections, userId, metadata) => {
      if (!activeUsers.some(user => user.id === userId)) throw new Error('请选择有效账户');
      const strategyId = crypto.randomUUID();
      const importedAt = new Date().toISOString();
      const result = prepareStrategy(pack, selections, userId, workflows, alerts, watchlist, today, { strategyId, importedAt });
      if (!(result.addedTasks + result.addedAlerts)) throw new Error('没有需要新增的任务或提醒');
      const record = createStrategyRecord({ id: strategyId, userId, importedAt, pack, links: result.links, repairs: metadata.repairs });
      const nextStrategies = [record, ...strategies];
      persistStrategy(result.workflows, result.alerts, nextStrategies);
      setWorkflows(result.workflows); setAlerts(result.alerts); setStrategies(nextStrategies); setActiveUserId(userId); setFocusedStrategyId(strategyId);
      setStrategyResult(`已导入 ${result.addedTasks} 项任务、${result.addedAlerts} 条提醒，并建立策略来源档案。跳过 ${result.skippedTasks} 项重复任务、${result.skippedAlerts} 条重复提醒。`);
      setStrategyOpen(false);
    }}/>}
    {managingUsers && <UserManagerModal users={users} onClose={() => setManagingUsers(false)} onAdd={addUser} onUpdate={updateUser} onToggleArchive={toggleArchive}/>}
    {alertsOpen && <AlertCenter alerts={alerts} watchlist={watchlist} users={users} selectedUserId={selectedUserId} hidden={privacyMode} onClose={() => setAlertsOpen(false)} onChange={setAlerts} onOpenStrategy={id => { setFocusedStrategyId(id); setAlertsOpen(false); setView('strategies'); }}/>}
  </div>;
}
