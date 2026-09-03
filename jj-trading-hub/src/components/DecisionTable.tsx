import type { DecisionRule } from '../types/market';

export function DecisionTable({ rows }: { rows: DecisionRule[] }) {
  return <div className="card">
    <div className="section-title">明日开盘决策表</div>
    {rows.map(r => <div className="decision" key={r.id}>
      <div><b>{r.stock}</b><span className="priority">{r.priority}</span></div>
      <div className="condition">当：{r.condition}</div>
      <div className="action">则：{r.action}</div>
    </div>)}
  </div>
}
