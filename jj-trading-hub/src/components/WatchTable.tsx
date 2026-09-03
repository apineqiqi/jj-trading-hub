import type { WatchItem } from '../types/market';

const cls = (v: number) => v >= 0 ? 'up' : 'down';

export function WatchTable({ items }: { items: WatchItem[] }) {
  return <div className="card table-card">
    <div className="section-title">核心观察池</div>
    <div className="watch-grid header"><span>标的</span><span>收盘</span><span>涨跌</span><span>评分</span><span>状态</span></div>
    {items.map(x => <div className="watch-row" key={x.symbol}>
      <div className="watch-grid main-row">
        <span><b>{x.name}</b><small>{x.symbol} · {x.group}</small></span>
        <span>{x.price.toFixed(2)}</span>
        <span className={cls(x.changePct)}>{x.changePct > 0 ? '+' : ''}{x.changePct.toFixed(2)}%</span>
        <span>{x.score.toFixed(1)}</span>
        <span><em className={`pill ${x.state}`}>{x.state}</em></span>
      </div>
      <div className="row-note">{x.note}</div>
      {(x.support || x.trigger || x.invalidation) && <div className="levels">
        {x.support && <span>支撑 {x.support}</span>}
        {x.trigger && <span>触发 {x.trigger}</span>}
        {x.invalidation && <span>失效 {x.invalidation}</span>}
      </div>}
    </div>)}
  </div>
}
