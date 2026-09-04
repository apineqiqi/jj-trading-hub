import { Archive, Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { UserProfile } from '../types/market';

const palette = ['#f2b84b', '#63b3ff', '#8edb9e', '#ff8c7a', '#b99cff', '#f0cf69'];

export function UserManagerModal({ users, onClose, onAdd, onUpdate, onToggleArchive }: { users: UserProfile[]; onClose: () => void; onAdd: (name: string, color: string) => void; onUpdate: (user: UserProfile) => void; onToggleArchive: (user: UserProfile) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(palette[users.length % palette.length]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const activeCount = users.filter(user => !user.archived).length;
  const submit = (event: FormEvent) => {
    event.preventDefault(); const next = name.trim(); if (!next) return;
    if (users.some(user => user.name.toLowerCase() === next.toLowerCase())) { setError('用户名称不能重复'); return; }
    onAdd(next, color); setName(''); setError(''); setColor(palette[(users.length + 1) % palette.length]);
  };
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="modal user-manager">
    <div className="modal-head"><div><span className="eyebrow">V0.6 ACCOUNT LAYER</span><h3>用户与账户视角</h3></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
    <p className="modal-copy">每位用户拥有独立的持仓和观察池；归档不会删除任何历史数据。</p>
    <div className="user-list">{users.map(user => <div className={`user-row ${user.archived ? 'archived' : ''}`} key={user.id}><i style={{ background: user.color }}/>{editing === user.id ? <input autoFocus value={editName} onChange={event => setEditName(event.target.value)}/> : <div><b>{user.name}</b><small>{user.archived ? '已归档 · 数据仍保留' : '可用账户'}</small></div>}<div className="user-row-actions">{editing === user.id ? <button className="tiny-btn" title="保存名称" onClick={() => { const next = editName.trim(); if (next && !users.some(item => item.id !== user.id && item.name.toLowerCase() === next.toLowerCase())) onUpdate({ ...user, name: next }); setEditing(null); }}><Check size={15}/></button> : <button className="tiny-btn" title="修改名称" onClick={() => { setEditing(user.id); setEditName(user.name); }}><Pencil size={14}/></button>}<button className="tiny-btn" disabled={!user.archived && activeCount === 1} title={!user.archived && activeCount === 1 ? '至少保留一位可用用户' : user.archived ? '恢复用户' : '归档用户'} onClick={() => onToggleArchive(user)}>{user.archived ? <RotateCcw size={14}/> : <Archive size={14}/>}</button></div></div>)}</div>
    <form className="new-user" onSubmit={submit}><div><span className="eyebrow">新增用户</span><input placeholder="例如：JJ、家人账户" value={name} onChange={event => { setName(event.target.value); setError(''); }} required/>{error && <small className="form-error">{error}</small>}</div><div className="color-palette" aria-label="用户颜色">{palette.map(item => <button type="button" key={item} className={color === item ? 'active' : ''} style={{ background: item }} onClick={() => setColor(item)}/>)}</div><button className="primary-btn" type="submit"><Plus size={15}/>创建用户</button></form>
  </div></div>;
}
