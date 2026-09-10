import { BellRing, BellRingIcon, Check, ChevronDown, CircleAlert, Pause, Play, Plus, Radio, ShieldAlert, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { AlertDirection, PriceAlert, UserProfile, WatchItem } from '../types/market';

const isTriggered = (rule: PriceAlert, price?: number) => price !== undefined && rule.enabled && (rule.direction === 'above' ? price >= rule.target : price <= rule.target);

export function AlertCenter({ alerts, watchlist, users, selectedUserId, hidden, onClose, onChange, onOpenStrategy }: {
  alerts: PriceAlert[];
  watchlist: WatchItem[];
  users: UserProfile[];
  selectedUserId: string;
  hidden: boolean;
  onClose: () => void;
  onChange: (alerts: PriceAlert[]) => void;
  onOpenStrategy: (strategyId: string) => void;
}) {
  const activeUsers = users.filter(user => !user.archived);
  const defaultUserId = selectedUserId === 'all' ? activeUsers[0]?.id ?? 'user-jj' : selectedUserId;
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'hit'>('all');
  const [form, setForm] = useState({ userId: defaultUserId, symbol: watchlist.find(item => item.userId === defaultUserId)?.symbol ?? '', direction: 'above' as AlertDirection, target: '', label: '' });
  const [permission, setPermission] = useState<NotificationPermission>(() => 'Notification' in window ? Notification.permission : 'denied');
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const itemMap = useMemo(() => new Map(watchlist.map(item => [`${item.userId ?? 'user-jj'}-${item.symbol}`, item])), [watchlist]);
  const visible = selectedUserId === 'all' ? alerts : alerts.filter(rule => rule.userId === selectedUserId);
  const triggered = visible.filter(rule => isTriggered(rule, itemMap.get(`${rule.userId}-${rule.symbol}`)?.price));
  const filtered = filter === 'hit' ? triggered : visible;

  const updateRule = (id: string, next: Partial<PriceAlert>) => onChange(alerts.map(rule => rule.id === id ? { ...rule, ...next } : rule));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const item = watchlist.find(entry => entry.userId === form.userId && entry.symbol === form.symbol);
    if (!item || !Number(form.target)) return;
    onChange([...alerts, { id: crypto.randomUUID(), userId: form.userId, symbol: item.symbol, name: item.name, direction: form.direction, target: Number(form.target), label: form.label.trim() || `${form.direction === 'above' ? '上穿' : '下破'} ${Number(form.target).toFixed(2)}`, enabled: true, acknowledged: false, createdAt: new Date().toISOString() }]);
    setFormOpen(false);
    setForm(current => ({ ...current, target: '', label: '' }));
  };
  const requestNotification = async () => {
    if (!('Notification' in window)) return;
    const next = await Notification.requestPermission();
    setPermission(next);
  };

  return <div className="alert-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <aside className="alert-center" aria-label="条件提醒中心">
      <div className="alert-head"><div><span className="eyebrow">SIGNAL WATCH · V0.8</span><h2>条件提醒中心</h2><p>行情刷新时自动核对价格边界；提醒只用于执行计划，不构成交易建议。</p></div><button className="icon-btn" aria-label="关闭提醒中心" onClick={onClose}><X size={18}/></button></div>
      <div className="alert-command">
        <div className={triggered.length ? 'hot' : ''}><Radio size={17}/><span><b>{triggered.length ? `${triggered.length} 条条件已命中` : '当前没有命中条件'}</b><small>{visible.filter(item => item.enabled).length} 条规则正在监控</small></span></div>
        {permission === 'default' ? <button className="ghost-btn" onClick={() => void requestNotification()}><BellRing size={14}/>开启浏览器通知</button> : <span className={`notify-state ${permission}`}><i/>{permission === 'granted' ? '系统通知已开启' : '仅使用页面内提醒'}</span>}
      </div>

      <div className="alert-toolbar"><div><button className={`alert-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>全部 {visible.length}</button><button className={`alert-filter ${filter === 'hit' ? 'active' : ''}`} onClick={() => setFilter('hit')}>已命中 {triggered.length}</button></div><button className="primary-btn" onClick={() => setFormOpen(value => !value)}><Plus size={14}/>新增提醒</button></div>

      {formOpen && <form className="alert-form" onSubmit={submit}>
        <label><span>账户</span><select value={form.userId} onChange={event => setForm(current => ({ ...current, userId: event.target.value, symbol: watchlist.find(item => item.userId === event.target.value)?.symbol ?? '' }))}>{activeUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label><span>标的</span><select value={form.symbol} onChange={event => setForm(current => ({ ...current, symbol: event.target.value }))}>{watchlist.filter(item => item.userId === form.userId).map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</select></label>
        <label><span>方向</span><select value={form.direction} onChange={event => setForm(current => ({ ...current, direction: event.target.value as AlertDirection }))}><option value="above">价格上穿</option><option value="below">价格下破</option></select></label>
        <label><span>目标价</span><input type="number" step="any" value={form.target} onChange={event => setForm(current => ({ ...current, target: event.target.value }))} required/></label>
        <label className="wide"><span>提醒说明</span><input value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))} placeholder="例如：站稳后检查量能"/></label>
        <button className="primary-btn" type="submit">保存提醒</button>
      </form>}

      <div className="alert-list">
        {filtered.length ? filtered.map(rule => {
          const item = itemMap.get(`${rule.userId}-${rule.symbol}`);
          const hit = isTriggered(rule, item?.price);
          return <article className={`${hit ? 'triggered' : ''} ${!rule.enabled ? 'paused' : ''}`} key={rule.id}>
            <div className="alert-status">{hit ? <BellRingIcon size={17}/> : rule.enabled ? <ChevronDown size={17}/> : <Pause size={16}/>}<i/></div>
            <div className="alert-copy"><div><b>{hidden ? '观察标的' : rule.name}</b><em>{userMap.get(rule.userId)?.name ?? 'JJ'}</em><span>{rule.direction === 'above' ? '达到或高于' : '达到或低于'} {hidden ? '••••' : rule.target.toFixed(2)}</span></div>{rule.planId && <strong className="plan-source-badge">计划关联 · {rule.planLevel === 'entry' ? '入场' : rule.planLevel === 'stop' ? '止损' : '目标'}</strong>}<p>{rule.sourceTitle && (rule.strategyId ? <button type="button" className="plan-source-badge strategy-source-link" aria-label={`查看策略来源 ${hidden ? '' : rule.sourceTitle}`} onClick={() => onOpenStrategy(rule.strategyId!)}>{hidden ? 'AI 策略来源已隐藏' : `AI 策略 · ${rule.sourceTitle}`}</button> : <span className="plan-source-badge">{hidden ? 'AI 策略来源已隐藏' : `旧版 AI 来源 · ${rule.sourceTitle}`}</span>)}{rule.sourceTitle && <br/>}{hidden ? '提醒说明已隐藏' : rule.label}</p><small>现价 {hidden ? '••••' : item?.price.toFixed(2) ?? '—'} · {!item ? '缺少观察池标的，无法核对行情' : rule.enabled ? hit ? rule.acknowledged ? '条件已命中 · 已知悉' : '条件已命中' : '等待价格进入边界' : '监控已暂停'}</small></div>
            <div className="alert-actions">{hit && !rule.acknowledged && <button title="确认已知悉" onClick={() => updateRule(rule.id, { acknowledged: true })}><Check size={15}/></button>}<button title={rule.enabled ? '暂停提醒' : '恢复提醒'} onClick={() => updateRule(rule.id, { enabled: !rule.enabled, acknowledged: false })}>{rule.enabled ? <Pause size={14}/> : <Play size={14}/>}</button><button title="删除提醒" onClick={() => window.confirm(`删除 ${rule.name} 的这条提醒？`) && onChange(alerts.filter(item => item.id !== rule.id))}><Trash2 size={14}/></button></div>
          </article>;
        }) : <div className="alert-empty"><CircleAlert size={30}/><b>{filter === 'hit' ? '当前没有命中条件' : '还没有条件提醒'}</b><span>{filter === 'hit' ? '价格进入设定边界后会出现在这里。' : '从观察池选择标的，设置上穿或下破价格。'}</span></div>}
      </div>
      <div className="alert-foot"><ShieldAlert size={14}/><span>页面关闭后无法继续监控。后台推送需要后续接入服务端，本版本不会误导为全天候提醒。</span></div>
    </aside>
  </div>;
}
