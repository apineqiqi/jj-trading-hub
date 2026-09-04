import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { UserProfile, WatchItem } from '../types/market';

const cls = (v: number) => v >= 0 ? 'up' : 'down';

export function WatchTable({ items, users, showOwners = false, onAdd, onEdit, onDelete }: {
  items: WatchItem[];
  users: UserProfile[];
  showOwners?: boolean;
  onAdd: () => void;
  onEdit: (item: WatchItem) => void;
  onDelete: (item: WatchItem) => void;
}) {
  const userMap = new Map(users.map(user => [user.id, user]));
  return <div className="card table-card">
    <div className="section-heading"><div><div className="section-title">核心观察池</div><span className="section-meta">{items.length} 个标的 · 自动保存</span></div><button className="primary-btn" onClick={onAdd}><Plus size={15}/>添加标的</button></div>
    <div className="watch-grid header"><span>标的</span><span>收盘</span><span>涨跌</span><span>评分</span><span>状态</span></div>
    {items.map(x => <div className="watch-row" key={`${x.userId ?? 'jj'}-${x.symbol}`}>
      <div className="watch-grid main-row">
        <span><b>{x.name}{x.quoteUpdatedAt && <i className="live-mark">行情</i>}</b><small>{x.symbol} · {x.group}{showOwners && <em className="owner-tag" style={{ '--owner-color': userMap.get(x.userId ?? '')?.color } as CSSProperties}>{userMap.get(x.userId ?? '')?.name ?? 'JJ'}</em>}</small></span>
        <span>{x.price.toFixed(2)}</span>
        <span className={cls(x.changePct)}>{x.changePct > 0 ? '+' : ''}{x.changePct.toFixed(2)}%</span>
        <span>{x.score.toFixed(1)}</span>
        <span className="row-actions"><em className={`pill ${x.state}`}>{x.state}</em><button className="tiny-btn" title={`编辑 ${x.name}`} onClick={() => onEdit(x)}><Pencil size={14}/></button><button className="tiny-btn danger" title={`删除 ${x.name}`} onClick={() => onDelete(x)}><Trash2 size={14}/></button></span>
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
