import { Activity, BellRing, BriefcaseBusiness, ChartNoAxesCombined, Eye, EyeOff, Gauge, LayoutDashboard, ListFilter, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DecisionTable } from './components/DecisionTable';
import { EditorModal } from './components/EditorModal';
import { MarketPulse, type QuoteStatus } from './components/MarketPulse';
import { PortfolioTable } from './components/PortfolioTable';
import { ReviewWorkspace } from './components/ReviewWorkspace';
import { StatCard } from './components/StatCard';
import { WatchTable } from './components/WatchTable';
import { accountSnapshot, decisions, initialPositions, initialSnapshots, watchlist as initialWatchlist } from './data/mock';
import { usePersistentState } from './hooks/usePersistentState';
import { fetchMarketQuotes } from './services/quotes';
import type { PortfolioSnapshot, Position, TradeRecord, WatchItem } from './types/market';

type View = 'overview' | 'portfolio' | 'watchlist' | 'review';
type EditorTarget = { kind: 'position'; value?: Position } | { kind: 'watch'; value?: WatchItem };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [positions, setPositions] = usePersistentState<Position[]>('jj-trading-v03-positions', initialPositions);
  const [watchlist, setWatchlist] = usePersistentState<WatchItem[]>('jj-trading-v02-watchlist', initialWatchlist);
  const [snapshots, setSnapshots] = usePersistentState<PortfolioSnapshot[]>('jj-trading-v04-snapshots', initialSnapshots);
  const [trades, setTrades] = usePersistentState<TradeRecord[]>('jj-trading-v04-trades', []);
  const [privacyMode, setPrivacyMode] = usePersistentState<boolean>('jj-trading-privacy-mode', false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [quoteState, setQuoteState] = useState<{ status: QuoteStatus; updatedAt?: string; count: number; message?: string }>({ status: 'loading', count: 0 });

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

  const portfolio = useMemo(() => positions.reduce((total, item) => total + (item.reportedMarketValue ?? item.price * item.shares), 0), [positions]);
  const pnl = useMemo(() => positions.reduce((total, item) => total + (item.reportedPnl ?? (item.price - item.cost) * item.shares), 0), [positions]);
  const totalAssets = portfolio + accountSnapshot.availableCash;
  const positionPct = totalAssets ? portfolio / totalAssets * 100 : 0;
  const attackSignals = watchlist.filter(item => item.state === '转强').length;
  const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const privateValue = (value: string) => privacyMode ? '••••••' : value;

  const saveEditor = (value: Position | WatchItem) => {
    if (editor?.kind === 'position') {
      const position = value as Position;
      setPositions(current => current.some(item => item.id === position.id) ? current.map(item => item.id === position.id ? position : item) : [...current, position]);
    } else {
      const watch = value as WatchItem;
      setWatchlist(current => current.some(item => item.symbol === watch.symbol) ? current.map(item => item.symbol === watch.symbol ? watch : item) : [...current, watch]);
    }
    setEditor(null);
  };

  const removePosition = (item: Position) => window.confirm(`删除 ${item.name} 的持仓记录？`) && setPositions(current => current.filter(x => x.id !== item.id));
  const removeWatch = (item: WatchItem) => window.confirm(`从观察池移除 ${item.name}？`) && setWatchlist(current => current.filter(x => x.symbol !== item.symbol));
  const removeSnapshot = (item: PortfolioSnapshot) => window.confirm(`删除 ${item.date} 的账户快照？`) && setSnapshots(current => current.filter(x => x.id !== item.id));
  const removeTrade = (item: TradeRecord) => window.confirm(`删除 ${item.date} ${item.name} 的交易记录？`) && setTrades(current => current.filter(x => x.id !== item.id));

  return <div className="app-shell">
    <header>
      <div><div className="brand-line"><span className="eyebrow">JJ PERSONAL TRADING OS</span><span className="version-badge">V0.5.1</span></div><h1>JJ 交易中枢</h1></div>
      <div className="header-actions"><button className={`privacy-toggle ${privacyMode ? 'active' : ''}`} aria-pressed={privacyMode} onClick={() => setPrivacyMode(value => !value)}>{privacyMode ? <Eye size={17}/> : <EyeOff size={17}/>}<span>{privacyMode ? '显示持仓' : '隐藏持仓'}</span></button><button className="icon-btn" title="提醒"><BellRing size={20}/></button></div>
    </header>

    <nav className="workspace-nav" aria-label="工作区">
      <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={16}/>总览</button>
      <button className={view === 'portfolio' ? 'active' : ''} onClick={() => setView('portfolio')}><BriefcaseBusiness size={16}/>持仓 <span>{positions.length}</span></button>
      <button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}><ListFilter size={16}/>观察池 <span>{watchlist.length}</span></button>
      <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}><ChartNoAxesCombined size={16}/>复盘 <span>{snapshots.length}</span></button>
      <div className="save-state"><i></i>本机已保存</div>
    </nav>

    <MarketPulse {...quoteState} onRefresh={() => void refreshQuotes()}/>

    <main>
      {view === 'overview' && <>
        <section className="hero card">
          <div><span className="eyebrow">{accountSnapshot.asOf}</span><h2>设备 / 测试 / 激光强于光模块核心</h2><p>已同步 JJ 最新账户快照。今日不是 CPO 整体 β 行情，联讯与炬光相对占优；寒武纪仍处等待确认阶段。</p></div>
          <div className="hero-score"><span>今日环境</span><strong>分化</strong></div>
        </section>
        <section className="stats">
          <StatCard title="总资产" value={privateValue(money(totalAssets))} sub={quoteState.status === 'success' ? '延迟行情估算' : accountSnapshot.asOf} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="持仓市值" value={privateValue(money(portfolio))} sub={`${positions.length} 个持仓`} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="可用现金" value={privateValue(money(accountSnapshot.availableCash))} sub="账户可用余额" icon={<Activity size={18}/>}/>
          <StatCard title="浮动盈亏" value={privateValue(`${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}`)} sub={quoteState.status === 'success' ? '行情估算口径' : '券商账户口径'} icon={<Activity size={18}/>}/>
          <StatCard title="当前仓位" value={privateValue(`${positionPct.toFixed(1)}%`)} sub="持仓市值 / 总资产" icon={<Gauge size={18}/>}/>
          <StatCard title="进攻信号" value={String(attackSignals)} sub={attackSignals ? '观察池出现转强' : '暂无转强标的'} icon={<Gauge size={18}/>}/>
        </section>
        <PortfolioTable items={positions} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
        <DecisionTable rows={decisions}/>
      </>}

      {view === 'portfolio' && <>
        <section className="view-intro"><span className="eyebrow">PORTFOLIO LEDGER · {accountSnapshot.asOf}</span><h2>持仓与成本</h2><p>已导入 JJ 最新持仓；后续手动编辑仍只保存在当前浏览器，不会上传到服务器。</p></section>
        <PortfolioTable items={positions} hidden={privacyMode} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
      </>}

      {view === 'watchlist' && <>
        <section className="view-intro"><span className="eyebrow">TACTICAL WATCHLIST</span><h2>观察池与交易边界</h2><p>持续维护状态、关键价位与失效条件，让盘中动作来自计划，而不是情绪。</p></section>
        <WatchTable items={watchlist} onAdd={() => setEditor({ kind: 'watch' })} onEdit={value => setEditor({ kind: 'watch', value })} onDelete={removeWatch}/>
      </>}

      {view === 'review' && <ReviewWorkspace
        hidden={privacyMode}
        snapshots={snapshots}
        trades={trades}
        currentSnapshot={{ totalAssets, marketValue: portfolio, cash: accountSnapshot.availableCash, unrealizedPnl: pnl }}
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

    {editor && <EditorModal target={editor} onClose={() => setEditor(null)} onSave={saveEditor}/>}
  </div>;
}
