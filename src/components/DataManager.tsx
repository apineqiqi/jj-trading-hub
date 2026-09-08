import { useState, type ChangeEvent } from 'react';
import type { UserProfile } from '../types/market';
import { downloadBackup, parseBackup, restoreBackup, type BackupData } from '../data/backup';

export function DataManager({ users, cash, onCash, data, onClose }: { users: UserProfile[]; cash: Record<string, number>; onCash: (next: Record<string, number>) => void; data: BackupData; onClose: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(users.map(user => [user.id, cash[user.id] === undefined ? '' : String(cash[user.id])])));
  const [preview, setPreview] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null); setError(''); setMessage('');
    if (!file) return;
    try { setPreview(parseBackup(await file.text())); } catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取备份'); }
    event.target.value = '';
  };
  const saveCash = () => {
    const entries = Object.entries(draft).filter(([, value]) => value.trim() !== '');
    if (entries.some(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0)) return setError('现金请输入大于等于零的金额');
    onCash(Object.fromEntries(entries.map(([id, value]) => [id, Number(value)])));
    setError(''); setMessage('现金已更新，资产与风控会使用新余额。');
  };
  const restore = () => {
    if (!preview || !window.confirm('用此备份替换本机所有账户、持仓、任务和复盘记录？请先保存好“恢复前备份”。')) return;
    try { restoreBackup(preview.data); window.location.reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : '恢复失败'); }
  };
  return <div className="modal-backdrop"><section className="modal data-manager" role="dialog" aria-modal="true" aria-label="账户资金与备份">
    <div className="modal-head"><div><span className="eyebrow">DATA & ACCOUNT · V1.2</span><h3>账户资金与备份</h3></div><button className="ghost-btn" onClick={onClose}>关闭</button></div>
    <p>现金留空表示尚未录入；填写 0 表示已确认没有现金。</p>
    <div className="form-grid">{users.map(user => <label key={user.id}><span>{user.name}{user.archived ? '（已归档）' : ''} · 可用现金</span><input aria-label={`${user.name}可用现金`} type="number" min="0" step="0.01" value={draft[user.id] ?? ''} onChange={event => setDraft(current => ({ ...current, [user.id]: event.target.value }))} placeholder="尚未录入"/></label>)}</div>
    <button className="primary-btn" onClick={saveCash}>保存账户现金</button>
    <hr/><h3>完整数据备份</h3><p>包含所有账户、持仓、现金、任务、交易记录和截图。保存失败时，导出仍会保留页面中的最新数据。</p>
    <div className="backup-actions"><button className="ghost-btn" onClick={() => downloadBackup(data)}>导出完整备份</button><label className="ghost-btn">选择恢复文件<input aria-label="选择恢复文件" type="file" accept=".json,application/json" onChange={event => void load(event)}/></label></div>
    {preview && <div className="backup-preview"><b>备份日期：{new Date(preview.createdAt).toLocaleString('zh-CN')}</b><p>{(preview.data['jj-trading-v06-users'] as unknown[]).length} 个账户 · {(preview.data['jj-trading-v06-positions'] as unknown[]).length} 条持仓 · {(preview.data['jj-trading-v07-workflows'] as unknown[]).length} 个交易日</p><p>恢复会覆盖当前本机数据。请先下载恢复前备份，再执行恢复。</p><button className="ghost-btn" onClick={() => { downloadBackup(data, '-恢复前'); setMessage('恢复前备份已生成，请确认下载文件已保存。'); }}>下载恢复前备份</button><button className="primary-btn" onClick={restore}>替换本机数据并恢复</button></div>}
    {message && <p role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section></div>;
}
