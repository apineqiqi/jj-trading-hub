import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Position, SignalState, WatchItem } from '../types/market';

type EditorTarget = { kind: 'position'; value?: Position } | { kind: 'watch'; value?: WatchItem };

export function EditorModal({ target, onClose, onSave }: {
  target: EditorTarget;
  onClose: () => void;
  onSave: (value: Position | WatchItem) => void;
}) {
  const isPosition = target.kind === 'position';
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const value = target.value;
    if (isPosition) {
      const p = value as Position | undefined;
      setForm({ id: p?.id ?? crypto.randomUUID(), symbol: p?.symbol ?? '', name: p?.name ?? '', owner: p?.owner ?? '', shares: String(p?.shares ?? ''), cost: String(p?.cost ?? ''), price: String(p?.price ?? '') });
    } else {
      const w = value as WatchItem | undefined;
      setForm({ symbol: w?.symbol ?? '', name: w?.name ?? '', price: String(w?.price ?? ''), changePct: String(w?.changePct ?? ''), group: w?.group ?? '', score: String(w?.score ?? 5), state: w?.state ?? '观察', support: w?.support ?? '', trigger: w?.trigger ?? '', invalidation: w?.invalidation ?? '', note: w?.note ?? '' });
    }
  }, [isPosition, target.value]);

  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isPosition) onSave({ id: form.id, symbol: form.symbol.trim(), name: form.name.trim(), owner: form.owner.trim() || '未标记', shares: Number(form.shares), cost: Number(form.cost), price: Number(form.price) });
    else onSave({ symbol: form.symbol.trim(), name: form.name.trim(), price: Number(form.price), changePct: Number(form.changePct), group: form.group.trim(), score: Number(form.score), state: form.state as SignalState, support: form.support.trim(), trigger: form.trigger.trim(), invalidation: form.invalidation.trim(), note: form.note.trim() });
  };

  const input = (label: string, key: string, type = 'text', required = true) => <label><span>{label}</span><input type={type} step={type === 'number' ? 'any' : undefined} value={form[key] ?? ''} onChange={e => set(key, e.target.value)} required={required}/></label>;

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><span className="eyebrow">LOCAL WORKSPACE</span><h3>{target.value ? '编辑' : '添加'}{isPosition ? '持仓' : '观察标的'}</h3></div><button type="button" className="icon-btn" onClick={onClose}><X size={19}/></button></div>
      <div className="form-grid">
        {input('股票代码', 'symbol')}{input('股票名称', 'name')}
        {isPosition ? <>{input('归属用户', 'owner')}{input('持仓数量', 'shares', 'number')}{input('成本价', 'cost', 'number')}{input('当前价', 'price', 'number')}</> : <>
          {input('板块', 'group')}{input('当前价', 'price', 'number')}{input('涨跌幅 %', 'changePct', 'number')}{input('评分（0–10）', 'score', 'number')}
          <label><span>状态</span><select value={form.state ?? '观察'} onChange={e => set('state', e.target.value)}><option>转强</option><option>观察</option><option>等待确认</option><option>防守</option></select></label>
          {input('支撑位', 'support', 'text', false)}{input('触发条件', 'trigger', 'text', false)}{input('失效条件', 'invalidation', 'text', false)}
          <label className="full-field"><span>观察备注</span><textarea value={form.note ?? ''} onChange={e => set('note', e.target.value)} required/></label>
        </>}
      </div>
      <div className="modal-actions"><button type="button" className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" type="submit">保存到本机</button></div>
    </form>
  </div>;
}
