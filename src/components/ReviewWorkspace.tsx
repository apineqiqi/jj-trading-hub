import { ArrowDownLeft, ArrowUpRight, BookOpen, Camera, Plus, Trash2, TrendingUp, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { PortfolioSnapshot, TradeRecord, TradeSide } from '../types/market';

const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });

function EquityCurve({ snapshots }: { snapshots: PortfolioSnapshot[] }) {
  const rows = useMemo(() => [...snapshots].sort((a, b) => a.date.localeCompare(b.date)), [snapshots]);
  const values = rows.map(item => item.totalAssets);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const spread = Math.max(max - min, max * 0.02, 1);
  const x = (index: number) => rows.length === 1 ? 360 : 54 + index * (612 / (rows.length - 1));
  const y = (value: number) => 178 - ((value - min) / spread) * 136;
  const path = rows.map((item, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(item.totalAssets)}`).join(' ');

  return <div className="curve-wrap">
    <svg className="equity-curve" viewBox="0 0 720 220" role="img" aria-label={`资产曲线，共 ${rows.length} 个快照`}>
      <defs>
        <linearGradient id="curveArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2b84b" stopOpacity=".28"/>
          <stop offset="1" stopColor="#f2b84b" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[42, 110, 178].map(line => <line key={line} x1="54" y1={line} x2="666" y2={line} className="chart-grid"/>)}
      {rows.length > 1 && <path d={`${path} L 666 190 L 54 190 Z`} fill="url(#curveArea)"/>}
      {rows.length > 1 && <path d={path} className="curve-line"/>}
      {rows.map((item, index) => <g key={item.id}>
        <circle cx={x(index)} cy={y(item.totalAssets)} r="5" className="curve-dot"/>
        <text x={x(index)} y="208" textAnchor="middle" className="chart-date">{item.date.slice(5)}</text>
      </g>)}
      <text x="8" y="46" className="chart-value">¥{compactMoney.format(max)}</text>
      <text x="8" y="182" className="chart-value">¥{compactMoney.format(min)}</text>
    </svg>
    {rows.length < 2 && <div className="curve-prompt"><TrendingUp size={17}/><span>{rows.length ? '记录第二个账户快照后，这里会连成收益曲线' : '先记录第一个账户快照'}</span></div>}
  </div>;
}

export function ReviewWorkspace({ snapshots, trades, currentSnapshot, hidden = false, onAddSnapshot, onDeleteSnapshot, onAddTrade, onDeleteTrade }: {
  snapshots: PortfolioSnapshot[];
  trades: TradeRecord[];
  currentSnapshot: Omit<PortfolioSnapshot, 'id' | 'date' | 'note'>;
  hidden?: boolean;
  onAddSnapshot: (item: PortfolioSnapshot) => void;
  onDeleteSnapshot: (item: PortfolioSnapshot) => void;
  onAddTrade: (item: TradeRecord) => void;
  onDeleteTrade: (item: TradeRecord) => void;
}) {
  const [snapshotForm, setSnapshotForm] = useState(false);
  const [tradeForm, setTradeForm] = useState(false);
  const sortedSnapshots = useMemo(() => [...snapshots].sort((a, b) => b.date.localeCompare(a.date)), [snapshots]);
  const sortedTrades = useMemo(() => [...trades].sort((a, b) => b.date.localeCompare(a.date)), [trades]);
  const oldest = sortedSnapshots.at(-1);
  const latest = sortedSnapshots[0];
  const assetChange = oldest && latest ? latest.totalAssets - oldest.totalAssets : 0;
  const returnPct = oldest?.totalAssets ? assetChange / oldest.totalAssets * 100 : 0;
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());
  const privateMoney = (value: number) => hidden ? '••••••' : `¥${money.format(value)}`;

  const addSnapshot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAddSnapshot({
      id: crypto.randomUUID(), date: String(data.get('date')),
      totalAssets: Number(data.get('totalAssets')), marketValue: Number(data.get('marketValue')),
      cash: Number(data.get('cash')), unrealizedPnl: Number(data.get('unrealizedPnl')),
      note: String(data.get('note') || '').trim()
    });
    setSnapshotForm(false);
  };

  const addTrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAddTrade({
      id: crypto.randomUUID(), date: String(data.get('date')), side: String(data.get('side')) as TradeSide,
      symbol: String(data.get('symbol')).trim(), name: String(data.get('name')).trim(),
      shares: Number(data.get('shares')), price: Number(data.get('price')), fee: Number(data.get('fee') || 0),
      note: String(data.get('note') || '').trim()
    });
    setTradeForm(false);
  };

  return <>
    <section className="review-hero">
      <div><span className="eyebrow">PERFORMANCE ARCHIVE · V0.4</span><h2>让每次决策留下证据</h2><p>账户快照负责回答“结果如何”，交易日志负责回答“当时为什么这样做”。所有记录仍只保存在当前浏览器。</p></div>
      <div className="review-actions"><button className="ghost-btn" onClick={() => setTradeForm(true)}><BookOpen size={15}/>记一笔交易</button><button className="primary-btn" onClick={() => setSnapshotForm(true)}><Camera size={15}/>记录账户快照</button></div>
    </section>

    <section className="review-summary">
      <div className="curve-card card">
        <div className="section-heading"><div><div className="section-title"><TrendingUp size={18}/>资产轨迹</div><span className="section-meta">按账户总资产绘制 · {snapshots.length} 个数据点</span></div><span className={assetChange >= 0 ? 'performance up' : 'performance down'}>{assetChange >= 0 ? '+' : ''}{returnPct.toFixed(2)}%</span></div>
        <div className={hidden ? 'privacy-chart' : ''}><EquityCurve snapshots={snapshots}/></div>
      </div>
      <div className="review-metrics">
        <div className="metric-block"><span>最新总资产</span><strong>{privateMoney(latest?.totalAssets ?? currentSnapshot.totalAssets)}</strong><small>{latest?.date ?? '等待快照'}</small></div>
        <div className="metric-block"><span>累计变化</span><strong className={hidden ? 'privacy-value' : assetChange >= 0 ? 'up' : 'down'}>{hidden ? '••••••' : `${assetChange >= 0 ? '+' : ''}¥${money.format(assetChange)}`}</strong><small>首个快照至今</small></div>
        <div className="metric-block"><span>已记录交易</span><strong>{trades.length}</strong><small>{trades.length ? '买卖动作可回溯' : '等待第一笔记录'}</small></div>
      </div>
    </section>

    <section className="review-ledgers">
      <div className="card ledger-card">
        <div className="section-heading"><div><div className="section-title">账户快照</div><span className="section-meta">每次同步持仓时留一张底片</span></div><button className="tiny-add" onClick={() => setSnapshotForm(true)}><Plus size={14}/>新增</button></div>
        <div className="snapshot-list">
          {sortedSnapshots.map(item => <article className="snapshot-row" key={item.id}>
            <time>{item.date}<i></i></time>
            <div><b>{privateMoney(item.totalAssets)}</b><span>{hidden ? '市值 •••••• · 现金 ••••••' : `市值 ¥${money.format(item.marketValue)} · 现金 ¥${money.format(item.cash)}`}</span>{item.note && <small>{item.note}</small>}</div>
            <div className={hidden ? 'privacy-value snapshot-pnl' : item.unrealizedPnl >= 0 ? 'up snapshot-pnl' : 'down snapshot-pnl'}>{hidden ? '••••••' : `${item.unrealizedPnl >= 0 ? '+' : ''}¥${money.format(item.unrealizedPnl)}`}</div>
            <button className="tiny-btn danger" title={`删除 ${item.date} 快照`} onClick={() => onDeleteSnapshot(item)}><Trash2 size={14}/></button>
          </article>)}
        </div>
      </div>

      <div className="card ledger-card">
        <div className="section-heading"><div><div className="section-title">交易日志</div><span className="section-meta">记录动作，也记录当时的理由</span></div><button className="tiny-add" onClick={() => setTradeForm(true)}><Plus size={14}/>新增</button></div>
        {sortedTrades.length ? <div className="trade-list">{sortedTrades.map(item => <article className="trade-row" key={item.id}>
          <div className={`side-icon ${item.side === '买入' ? 'buy' : 'sell'}`}>{item.side === '买入' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}</div>
          <div><b>{hidden ? '交易标的' : item.name}<em>{item.side}</em></b><span>{hidden ? `${item.date} · •••••• · •••• 股 × ••••••` : `${item.date} · ${item.symbol} · ${item.shares} 股 × ¥${money.format(item.price)}`}</span>{item.note && <small>{item.note}</small>}</div>
          <strong>{hidden ? '••••••' : `¥${money.format(item.shares * item.price + (item.side === '买入' ? item.fee : -item.fee))}`}</strong>
          <button className="tiny-btn danger" title={`删除 ${item.name} 交易`} onClick={() => onDeleteTrade(item)}><Trash2 size={14}/></button>
        </article>)}</div> : <div className="ledger-empty"><BookOpen size={26}/><b>还没有交易记录</b><span>从下一笔买卖开始，把动作和理由一起留下。</span><button className="ghost-btn" onClick={() => setTradeForm(true)}>记录第一笔</button></div>}
      </div>
    </section>

    {snapshotForm && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setSnapshotForm(false)}>
      <form className="modal compact-modal" onSubmit={addSnapshot}>
        <div className="modal-head"><div><span className="eyebrow">ACCOUNT CHECKPOINT</span><h3>记录账户快照</h3></div><button type="button" className="icon-btn" onClick={() => setSnapshotForm(false)}><X size={19}/></button></div>
        <div className="form-grid">
          <label><span>日期</span><input name="date" type="date" defaultValue={today} required/></label>
          <label><span>总资产</span><input name="totalAssets" type="number" step="0.01" defaultValue={currentSnapshot.totalAssets} required/></label>
          <label><span>持仓市值</span><input name="marketValue" type="number" step="0.01" defaultValue={currentSnapshot.marketValue} required/></label>
          <label><span>可用现金</span><input name="cash" type="number" step="0.01" defaultValue={currentSnapshot.cash} required/></label>
          <label><span>浮动盈亏</span><input name="unrealizedPnl" type="number" step="0.01" defaultValue={currentSnapshot.unrealizedPnl} required/></label>
          <label className="full-field"><span>备注</span><textarea name="note" placeholder="例如：收盘持仓截图同步"/></label>
        </div>
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setSnapshotForm(false)}>取消</button><button className="primary-btn" type="submit">保存快照</button></div>
      </form>
    </div>}

    {tradeForm && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setTradeForm(false)}>
      <form className="modal compact-modal" onSubmit={addTrade}>
        <div className="modal-head"><div><span className="eyebrow">EXECUTION JOURNAL</span><h3>记录交易</h3></div><button type="button" className="icon-btn" onClick={() => setTradeForm(false)}><X size={19}/></button></div>
        <div className="form-grid">
          <label><span>日期</span><input name="date" type="date" defaultValue={today} required/></label>
          <label><span>方向</span><select name="side" defaultValue="买入"><option>买入</option><option>卖出</option></select></label>
          <label><span>股票代码</span><input name="symbol" placeholder="688167" required/></label>
          <label><span>股票名称</span><input name="name" placeholder="炬光科技" required/></label>
          <label><span>数量</span><input name="shares" type="number" min="1" step="1" required/></label>
          <label><span>成交价</span><input name="price" type="number" min="0" step="0.001" required/></label>
          <label><span>费用</span><input name="fee" type="number" min="0" step="0.01" defaultValue="0"/></label>
          <label className="full-field"><span>交易理由 / 复盘备注</span><textarea name="note" placeholder="触发条件、执行偏差、下一步观察……"/></label>
        </div>
        <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setTradeForm(false)}>取消</button><button className="primary-btn" type="submit">保存交易</button></div>
      </form>
    </div>}
  </>;
}
