import { Pencil, Plus, Trash2, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Position } from '../types/market';

const money = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const price = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function PortfolioTable({ items, hidden = false, onAdd, onEdit, onDelete }: {
  items: Position[];
  hidden?: boolean;
  onAdd: () => void;
  onEdit: (item: Position) => void;
  onDelete: (item: Position) => void;
}) {
  const [ownerFilter, setOwnerFilter] = useState('全部');
  const owners = useMemo(() => Array.from(new Set(items.map(item => item.owner?.trim() || '未标记'))), [items]);
  const activeOwner = ownerFilter === '全部' || owners.includes(ownerFilter) ? ownerFilter : '全部';
  const visibleItems = activeOwner === '全部' ? items : items.filter(item => (item.owner?.trim() || '未标记') === activeOwner);

  return <section className="card table-card portfolio-card">
    <div className="section-heading"><div><div className="section-title">我的持仓</div><span className="section-meta">按用户归属查看 · 数据仅保存在当前浏览器</span></div><button className="primary-btn" onClick={onAdd}><Plus size={15}/>添加持仓</button></div>
    {items.length === 0 ? <div className="empty-state"><WalletCards size={30}/><b>还没有录入持仓</b><span>添加第一笔持仓后，这里会自动计算市值与浮动盈亏。</span><button className="ghost-btn" onClick={onAdd}>开始录入</button></div> : <>
      <div className="owner-filters" aria-label="按用户筛选持仓">
        {['全部', ...owners].map(owner => <button key={owner} className={activeOwner === owner ? 'active' : ''} onClick={() => setOwnerFilter(owner)}>{owner}<span>{owner === '全部' ? items.length : items.filter(item => (item.owner?.trim() || '未标记') === owner).length}</span></button>)}
      </div>
      <div className="position-grid position-header"><span>标的</span><span>数量</span><span>成本 / 现价</span><span>市值</span><span>浮盈亏</span><span></span></div>
      {visibleItems.map((item, index) => {
        const marketValue = item.reportedMarketValue ?? item.price * item.shares;
        const pnl = item.reportedPnl ?? (item.price - item.cost) * item.shares;
        const pnlPct = item.reportedReturnPct ?? (item.cost ? (item.price / item.cost - 1) * 100 : 0);
        return <div className="position-grid position-row" key={item.id}>
          <span><b>{hidden ? `持仓标的 ${String(index + 1).padStart(2, '0')}` : item.name}{item.quoteUpdatedAt && <i className="live-mark">行情</i>}</b><small>{hidden ? '••••••' : item.symbol}<em className="owner-tag">{item.owner?.trim() || '未标记'}</em></small></span>
          <span>{hidden ? '••••' : item.shares}</span>
          <span><small>{hidden ? '••••••' : `¥${price.format(item.cost)}`}</small>{hidden ? '••••••' : `¥${price.format(item.price)}`}</span>
          <span>{hidden ? '••••••' : `¥${money.format(marketValue)}`}</span>
          <span className={hidden ? 'privacy-value' : pnl >= 0 ? 'up' : 'down'}>{hidden ? '••••••' : `${pnl >= 0 ? '+' : ''}¥${money.format(pnl)}`}<small>{hidden ? '••••' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(3)}%`}</small></span>
          <span className="row-actions"><button className="tiny-btn" title={hidden ? '编辑持仓' : `编辑 ${item.name}`} onClick={() => onEdit(item)}><Pencil size={14}/></button><button className="tiny-btn danger" title={hidden ? '删除持仓' : `删除 ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={14}/></button></span>
        </div>;
      })}
    </>}
  </section>;
}
