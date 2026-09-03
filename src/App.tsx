import { Activity, BellRing, BriefcaseBusiness, Gauge, LayoutDashboard, ListFilter, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DecisionTable } from './components/DecisionTable';
import { EditorModal } from './components/EditorModal';
import { PortfolioTable } from './components/PortfolioTable';
import { StatCard } from './components/StatCard';
import { WatchTable } from './components/WatchTable';
import { decisions, watchlist as initialWatchlist } from './data/mock';
import { usePersistentState } from './hooks/usePersistentState';
import type { Position, WatchItem } from './types/market';

type View = 'overview' | 'portfolio' | 'watchlist';
type EditorTarget = { kind: 'position'; value?: Position } | { kind: 'watch'; value?: WatchItem };

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [positions, setPositions] = usePersistentState<Position[]>('jj-trading-v02-positions', []);
  const [watchlist, setWatchlist] = usePersistentState<WatchItem[]>('jj-trading-v02-watchlist', initialWatchlist);
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  const portfolio = useMemo(() => positions.reduce((total, item) => total + item.price * item.shares, 0), [positions]);
  const pnl = useMemo(() => positions.reduce((total, item) => total + (item.price - item.cost) * item.shares, 0), [positions]);
  const attackSignals = watchlist.filter(item => item.state === '转强').length;

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

  return <div className="app-shell">
    <header>
      <div><div className="brand-line"><span className="eyebrow">JJ PERSONAL TRADING OS</span><span className="version-badge">V0.2</span></div><h1>JJ 交易中枢</h1></div>
      <button className="icon-btn" title="提醒"><BellRing size={20}/></button>
    </header>

    <nav className="workspace-nav" aria-label="工作区">
      <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><LayoutDashboard size={16}/>总览</button>
      <button className={view === 'portfolio' ? 'active' : ''} onClick={() => setView('portfolio')}><BriefcaseBusiness size={16}/>持仓 <span>{positions.length}</span></button>
      <button className={view === 'watchlist' ? 'active' : ''} onClick={() => setView('watchlist')}><ListFilter size={16}/>观察池 <span>{watchlist.length}</span></button>
      <div className="save-state"><i></i>本机已保存</div>
    </nav>

    <main>
      {view === 'overview' && <>
        <section className="hero card">
          <div><span className="eyebrow">2026-09-03 收盘</span><h2>设备 / 测试 / 激光强于光模块核心</h2><p>今日不是 CPO 整体 β 行情，联讯与炬光相对占优；寒武纪仍处等待确认阶段。</p></div>
          <div className="hero-score"><span>今日环境</span><strong>分化</strong></div>
        </section>
        <section className="stats">
          <StatCard title="持仓市值" value={positions.length ? `¥${Math.round(portfolio).toLocaleString()}` : '—'} sub={positions.length ? `${positions.length} 个持仓` : '等待录入持仓'} icon={<BriefcaseBusiness size={18}/>}/>
          <StatCard title="浮动盈亏" value={positions.length ? `${pnl >= 0 ? '+' : '-'}¥${Math.abs(Math.round(pnl)).toLocaleString()}` : '—'} sub="依据手动更新的现价" icon={<Activity size={18}/>}/>
          <StatCard title="进攻信号" value={String(attackSignals)} sub={attackSignals ? '观察池出现转强' : '暂无转强标的'} icon={<Gauge size={18}/>}/>
        </section>
        <PortfolioTable items={positions} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
        <DecisionTable rows={decisions}/>
      </>}

      {view === 'portfolio' && <>
        <section className="view-intro"><span className="eyebrow">PORTFOLIO LEDGER</span><h2>持仓与成本</h2><p>这里是你的唯一持仓口径。现阶段数据只保存在当前浏览器，不会上传到服务器。</p></section>
        <PortfolioTable items={positions} onAdd={() => setEditor({ kind: 'position' })} onEdit={value => setEditor({ kind: 'position', value })} onDelete={removePosition}/>
      </>}

      {view === 'watchlist' && <>
        <section className="view-intro"><span className="eyebrow">TACTICAL WATCHLIST</span><h2>观察池与交易边界</h2><p>持续维护状态、关键价位与失效条件，让盘中动作来自计划，而不是情绪。</p></section>
        <WatchTable items={watchlist} onAdd={() => setEditor({ kind: 'watch' })} onEdit={value => setEditor({ kind: 'watch', value })} onDelete={removeWatch}/>
      </>}

      <section className="card checklist">
        <div className="section-title"><ShieldCheck size={18}/>执行纪律</div>
        <p>新仓必须同时具备：触发价、失效价、仓位动作。事实口径未确认时，只输出条件判断，不给确定性加减仓结论。</p>
        <div className="chips"><span>单股≤35%</span><span>组合≤80%</span><span>单笔风险≤1%</span><span>日亏损≤2%</span><span>计划盈亏比≥2</span></div>
      </section>
    </main>

    {editor && <EditorModal target={editor} onClose={() => setEditor(null)} onSave={saveEditor}/>}
  </div>;
}
