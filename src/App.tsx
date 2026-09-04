import { Activity, BellRing, BriefcaseBusiness, ChartNoAxesCombined, Eye, EyeOff, Gauge, LayoutDashboard, ListChecks, ListFilter, ShieldCheck, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DecisionTable } from './components/DecisionTable';
import { EditorModal } from './components/EditorModal';
import { MarketPulse, type QuoteStatus } from './components/MarketPulse';
import { PortfolioTable } from './components/PortfolioTable';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { StatCard } from './components/StatCard';
import { TradingWorkflow } from './components/TradingWorkflow';
import { UserManagerModal } from './components/UserManagerModal';
import { UserSwitcher } from './components/UserSwitcher';
import { WatchTable } from './components/WatchTable';
import { accountSnapshot, decisions, initialPositions, initialSnapshots, watchlist as initialWatchlist } from './data/mock';
import { defaultUser, migratePositions, migrateUsers, migrateWatchlist } from './data/migration';
import { usePersistentState } from './hooks/usePersistentState';
import { fetchMarketQuotes } from './services/quotes';
import type { DailyWorkflow, PortfolioSnapshot, Position, TradeRecord, UserProfile, WatchItem } from './types/market';

type View = 'overview' | 'workflow' | 'portfolio' | 'watchlist' | 'review';
type EditorTarget = { kind: 'position'; value?: Position } | { kind: 'watch'; value?: WatchItem };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [users, setUsers] = usePersistentState<UserProfile[]>('jj-trading-v06-users', migrateUsers());
  const [activeUserId, setActiveUserId] = usePersistentState<string>('jj-trading-v06-active-user', 'all');
  const [positions, setPositions] = usePersistentState<Position[]>('jj-trading-v06-positions', migratePositions());
  const [watchlist, setWatchlist] = usePersistentState<WatchItem[]>('jj-trading-v06-watchlist', migrateWatchlist());
  const [snapshots, setSnapshots] = usePersistentState<PortfolioSnapshot[]>('jj-trading-v04-snapshots', initialSnapshots);
  const [trades, setTrades] = usePersistentState<TradeRecord[]>('jj-trading-v04-trades', []);
  const [privacyMode, setPrivacyMode] = usePersistentState<boolean>('jj-trading-privacy-mode', false);
  const [workflows, setWorkflows] = usePersistentState<DailyWorkflow[]>('jj-trading-v07-workflows', []);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [managingUsers, setManagingUsers] = useState(false);
  const [quoteState, setQuoteState] = useState<{ status: QuoteStatus; updatedAt?: string; count: number; message?: string }>({ status: 'loading', count: 0 });

  const activeUsers = users.filter(user => !user.archived);
  const selectedUserId = activeUserId === 'all' || activeUsers.some(user => user.id === activeUserId) ? activeUserId : 'all';
  const scopedPositions = selectedUserId === 'all' ? positions : positions.filter(item => item.userId === selectedUserId);
  const scopedWatchlist = selectedUserId === 'all' ? watchlist : watchlist.filter(item => item.userId === selectedUserId);
  const activeProfile = users.find(user => user.id === selectedUserId);
  const editorUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? defaultUser.id : selectedUserId;
  const workflowUserId = selectedUserId === 'all' ? defaultUser.id : selectedUserId;
  const workflowOwner = users.find(user => user.id === workflowUserId)?.name ?? 'JJ';
  const workflowPositions = positions.filter(item => item.userId === workflowUserId);
  const workflowWatchlist = watchlist.filter(item => item.userId === workflowUserId);
  const today = new Date().toLocaleDateString('sv-SE');
  const workflow = workflows.find(item => item.userId === workflowUserId && item.date === today) ?? { id: `${workflowUserId}-${today}`, userId: workflowUserId, date: today, checks: {}, notes: {}, updatedAt: new Date().toISOString() };

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

  const portfolio = useMemo(() => scopedPositions.reduce((total, item) => total + (item.reportedMarketValue ?? item.price * item.shares), 0), [scopedPositions]);
  const pnl = useMemo(() => scopedPositions.reduce((total, item) => total + (item.reportedPnl ?? (item.price - item.cost) * item.shares), 0), [scopedPositions]);
  const scopedCash = selectedUserId === 'all' || selectedUserId === defaultUser.id ? accountSnapshot.availableCash : 0;
  const totalAssets = portfolio + scopedCash;
  const positionPct = totalAssets ? portfolio / totalAssets * 100 : 0;
  const attackSignals = scopedWatchlist.filter(item => item.state === '转强').length;
  const workflowPortfolio = workflowPositions.reduce((total, item) => total + (item.reportedMarketValue ?? item.price * item.shares), 0);
  const workflowCash = workflowUserId === defaultUser.id ? accountSnapshot.availableCash : 0;
  const workflowPositionPct = workflowPortfolio + workflowCash ? workflowPortfolio / (workflowPortfolio + workflowCash) * 100 : 0;
  const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const privateValue = (value: string) => privacyMode ? '••••••' : value;
  const workflowCompleted = Object.values(workflow.checks).filter(Boolean).length;
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
      <div><div className="brand-line"><span className="eyebrow">JJ PERSONAL TRADING OS</span><span className="version-badge">V0.7</span></div><h1>JJ 交易中枢</h1></div>
      <div className="header-actions"><UserSwitcher users={users} value={selectedUserId} onChange={setActiveUserId} onManage={() => setManagingUsers(true)}/><button className={`privacy-toggle ${privacyMode ? 'active' : ''}`} aria-pressed={privacyMode} onClick={() => setPrivacyMode(value => !value)}>{privacyMode ? <Eye size={17}/> : <EyeOff size={17}/>}<span>{privacyMode ? '显示持仓' : '隐藏持仓'}</span></button><button className="icon-btn" title="提醒"><BellRing size={20}/></button></div>
    </header>

    <nav className="workspace-nav" aria-label="工作区">
      <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={16}/>总览</button>
      <button className={view === 'workflow' ? 'active' : ''} onClick={() => setView('workflow')}><ListChecks size={16}/>交易日 <span>{workflowCompleted}/12</span></button>
      <button className={view === 'portfolio' ? 'active' : ''} onClick={() => setView('portfolio')}><BriefcaseBusiness size={16}/>持仓 <span>{scopedPositions.length}</span></button>
      <button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}><ListFilter size={16}/>观察池 <span>{scopedWatchlist.length}</span></button>
      <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><ChartNoAxesCombined size={16}/>复盘 <span>{snapshots.length}</span></button>
      <div className="save-state"><i></i>本机已保存</div>
    </nav>

    <MarketPulse {...quoteState} onRefresh={() => void refreshQuotes()}/>

    <main>
      {view === 'overview' && <>
        <section className="account-scope"><span style={{ background: activeProfile?.color ?? '#f2b84b' }}></span><UsersRound size={15}/><b>{activeProfile?.name ?? '全账户'}</b><small>{activeProfile ? '独立用户视角' : `${activeUsers.length} 位用户的合并视角`}</small></section>
        <button className="workflow-launch" onClick={() => setView('workflow')}>
          <span className="workflow-launch-icon"><ListChecks size={19}/></span><span><small>今日交易流程 · {workflowOwner}</small><b>{workflowCompleted === 12 ? '今日流程已完成' : `还有 ${12 - workflowCompleted} 项待确认`}</b></span><span className="workflow-launch-progress"><i style={{ width: `${workflowCompleted / 12 * 100}%` }}/></span><em>{workflowCompleted}/12</em><span className="workflow-launch-cta">继续 <span>→</span></span>
        </button>
        <section className="hero card">
          <div><span className="eyebrow">{accountSnapshot.asOf}</span><h2>设备 / 测试 / 激光强于光模块核心</h2><p>已同步 JJ 最新账户快照。今日不是 CPO 整体 β 行情，联讯与炬光相对占优；寒武纪仍处等待确认阶段。</p></div>
          <div className="hero-score"><span>今日环境</span><strong>分化</strong></div>
        </section>
        <section className="stats">
          <StatCard title="总资产" value={privateValue(money(totalAssets))} sub={quoteState.status === 'success' ? '延迟行情估算' : accountSnapshot.asOf} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="持仓市值" value={privateValue(money(portfolio))} sub={`${scopedPositions.length} 个持仓`} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="可用现金" value={selectedUserId === 'all' || selectedUserId === defaultUser.id ? privateValue(money(scopedCash)) : '—'} sub={selectedUserId === 'all' || selectedUserId === defaultUser.id ? 'JJ 账户可用余额' : '该用户尚未录入现金'} icon={<Activity size={18}/>}/>
          <StatCard title="浮动盈亏" value={privateValue(`${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}`)} sub={quoteState.status === 'success' ? '行情估算口径' : '券商账户口径'} icon={<Activity size={18}/>}/>
          <StatCard title="当前仓位" value={privateValue(`${positionPct.toFixed(1)}%`)} sub="持仓市值 / 总资产" icon={<Gauge size={18}/>}/>
          <StatCard title="进攻信号" value={String(attackSignals)} sub={attackSignals ? '观察池出现转强' : '暂无转强标的'} icon={<Gauge size={18}/>}/>
        </section>
        <PortfolioTable items={scopedPositions} users={users} showOwners={selectedUserId === 'all'} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
        <DecisionTable rows={decisions}/>
      </>}

      {view === 'portfolio' && <>
        <section className="view-intro"><span className="eyebrow">PORTFOLIO LEDGER · {activeProfile?.name ?? 'ALL ACCOUNTS'}</span><h2>持仓与成本</h2><p>用户数据彼此隔离；全账户视角用于统一查看风险与资金分布。</p></section>
        <PortfolioTable items={scopedPositions} users={users} showOwners={selectedUserId === 'all'} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
      </>}

      {view === 'watchlist' && <>
        <section className="view-intro"><span className="eyebrow">TACTICAL WATCHLIST</span><h2>观察池与交易边界</h2><p>持续维护状态、关键价位与失效条件，让盘中动作来自计划，而不是情绪。</p></section>
        <WatchTable items={scopedWatchlist} users={users} showOwners={selectedUserId === 'all'} onAdd={() => setEditor({ kind: 'watch' })} onEdit={value => setEditor({ kind: 'watch', value })} onDelete={removeWatch}/>
      </>}

      {view === 'workflow' && <TradingWorkflow record={workflow} ownerName={workflowOwner} positions={workflowPositions.length} attackSignals={workflowWatchlist.filter(item => item.state === '转强').length} positionPct={workflowPositionPct} hidden={privacyMode} onChange={saveWorkflow}/>}

      {view === 'review' && <ReviewWorkspace
        hidden={privacyMode}
        snapshots={snapshots}
        trades={trades}
        currentSnapshot={{ totalAssets, marketValue: portfolio, cash: scopedCash, unrealizedPnl: pnl }}
        onAddSnapshot={item => setSnapshots(current => [...current, item])}
        onDeleteSnapshot={removeSnapshot}
        onAddTrade={item => setTrades(current => [...current, item])}
        onDeleteTrade={removeTrade}
      />}

      <section className="card checklist">
        <div className="section-title"><ShieldCheck size={18}/>执行纪律</div>
        <p>新仓必须同时具备：触发价、失效价、仓位动作。事实口径未确认时，只输出条件判断，不给确定性加减仓结论。</p>
        <div className="chips"><span>单股≤35%</span><span>组合≤80%</span><span>单笔风险≤1%</span><span>日亏损≤2%</span><span>计划盈亏比≥2</span></div>
      </section>
    </main>

    {editor && <EditorModal target={editor} users={activeUsers} defaultUserId={editorUserId} onClose={() => setEditor(null)} onSave={saveEditor}/>}
    {managingUsers && <UserManagerModal users={users} onClose={() => setManagingUsers(false)} onAdd={addUser} onUpdate={updateUser} onToggleArchive={toggleArchive}/>}
  </div>;
}
