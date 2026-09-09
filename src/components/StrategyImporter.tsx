import { useMemo, useState } from 'react';
import { localDay, parseStrategyInput, prepareStrategy, reminderIssue, strategyPrompt, type StrategyPackage, type StrategySelection } from '../data/strategyImport';
import type { DailyWorkflow, PriceAlert, UserProfile, WatchItem } from '../types/market';

export function StrategyImporter({ users, selectedUserId, workflows, alerts, watchlist, onClose, onImport }: {
  users: UserProfile[]; selectedUserId: string; workflows: DailyWorkflow[]; alerts: PriceAlert[]; watchlist: WatchItem[];
  onClose: () => void; onImport: (pack: StrategyPackage, selections: StrategySelection[], userId: string) => void;
}) {
  const [userId, setUserId] = useState(selectedUserId === 'all' ? '' : selectedUserId);
  const [raw, setRaw] = useState('');
  const [selections, setSelections] = useState<Record<number, StrategySelection>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const today = localDay(); const prompt = strategyPrompt(today);
  const parsed = useMemo(() => {
    if (!raw.trim()) return { pack: null, normalized: '', repairs: [] as string[], error: '' };
    try { return { ...parseStrategyInput(raw), error: '' }; } catch (error) { return { pack: null, normalized: '', repairs: [] as string[], error: (error as Error).message }; }
  }, [raw]);
  const choices = parsed.pack?.tasks.map((_, index) => selections[index] ?? { task: true, alert: false }) ?? [];
  let preview: ReturnType<typeof prepareStrategy> | null = null; let issue = parsed.error;
  if (parsed.pack) {
    try { preview = prepareStrategy(parsed.pack, choices, userId, workflows, alerts, watchlist, today); } catch (error) { issue = (error as Error).message; }
  }
  const owner = users.find(user => user.id === userId && !user.archived);
  const select = (index: number, field: keyof StrategySelection, value: boolean) => {
    setSelections(current => ({ ...current, [index]: { ...choices[index], [field]: value } })); setConfirmed(false); setError('');
  };
  return <div className="modal-backdrop chat-import-backdrop"><section className="modal chat-import-modal strategy-import" role="dialog" aria-modal="true" aria-label="AI 策略快导">
    <div className="modal-head"><div><span className="eyebrow">STRATEGY INTAKE · V1.5</span><h3>AI 策略快导</h3><p>一次粘贴，自动检查常见格式，再分别确认任务与价格边界。不会读取 AI 账户或自动下单。</p></div><button className="ghost-btn" onClick={onClose}>关闭</button></div>
    <div className="strategy-steps"><span>01 复制提示词给 AI</span><span>02 粘贴结果并核对</span><span>03 确认账户后导入</span></div>
    <div className="chat-import-grid"><div className="chat-source-panel chat-paste-fields">
      <button className="ghost-btn" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setNotice('提示词已复制，请发给 AI 策略对话'); } catch { setNotice('复制不可用，请展开下方提示词，手动全选复制'); } }}>复制 AI 整理提示词</button>
      <details><summary>查看 / 手动复制提示词</summary><textarea aria-label="AI 整理提示词" readOnly value={prompt}/></details>
      {notice && <p role="status">{notice}</p>}
      <label>导入账户<select aria-label="导入账户" value={userId} onChange={event => { setUserId(event.target.value); setSelections({}); setConfirmed(false); setError(''); }}><option value="">请选择具体账户</option>{users.filter(user => !user.archived).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>策略 JSON<textarea aria-label="策略 JSON" value={raw} onChange={event => { setRaw(event.target.value); setSelections({}); setConfirmed(false); setError(''); }} placeholder="把 AI 按提示词生成的 JSON 粘贴到这里，也支持 JSON 代码块。"/></label>
      {!!parsed.repairs.length && <div className="strategy-repair" role="status"><div><b>已识别并安全修复常见格式</b><span>{parsed.repairs.join('、')}；正文中的中文引号保持不变。</span></div><button className="ghost-btn" onClick={() => { setRaw(parsed.normalized); setSelections({}); setConfirmed(false); setError(''); }}>替换为标准 JSON</button></div>}
      <p>仅导入今天 {today} 的策略。旧策略请先让 AI 重新复核；内容不上传。需要修改条件时，可直接编辑上方 JSON。</p>
      <p>提醒是独立的价格阈值，不验证量能、仓位或成交。勾选启用后，已满足的价格条件可能立即提示；暂停规则不会因重复导入而恢复。</p>
      {(issue || error) && <p className="form-error" role="alert">{error || issue}</p>}
    </div><div className="chat-preview-panel">
      <div className="chat-preview-head"><b>{parsed.pack ? `${parsed.pack.title} · ${parsed.pack.date}` : '等待策略内容'}</b></div>
      <div className="strategy-candidates">{parsed.pack?.tasks.map((task, index) => {
        const alertIssue = reminderIssue(task, userId, watchlist);
        return <article className="strategy-candidate" key={index}>
          <label><input type="checkbox" aria-label={`导入执行任务 ${index + 1}`} checked={choices[index].task} onChange={event => select(index, 'task', event.target.checked)}/><b>{({ pre: '盘前', live: '盘中', close: '收盘' })[task.phase]} · {task.title}</b></label>
          <p>{task.detail}</p>
          {task.alert && <div className="strategy-price"><span>{task.alert.name} · {task.alert.symbol}</span><b>{task.alert.direction === 'above' ? '≥' : '≤'} {task.alert.target}</b></div>}
          <label className="strategy-alert-choice"><input type="checkbox" aria-label={`启用价格提醒 ${index + 1}`} disabled={!!alertIssue || !owner} checked={choices[index].alert} onChange={event => select(index, 'alert', event.target.checked)}/>{alertIssue || '同时启用此价格提醒（独立于任务完成状态）'}</label>
        </article>;
      }) ?? <p>普通对话文字仍可通过原来的“从 ChatGPT 导入”入口导入任务。</p>}</div>
    </div></div>
    <div className="strategy-confirm">
      <p role="status">将新增 {preview?.addedTasks ?? 0} 项任务、{preview?.addedAlerts ?? 0} 条提醒；跳过 {preview?.skippedTasks ?? 0} 项重复任务、{preview?.skippedAlerts ?? 0} 条重复提醒。</p>
      <p>任务按当天阶段、标题和完整详情去重；提醒按账户、代码、方向、价格去重（包括暂停规则）。策略修改后不会覆盖旧记录，请自行清理过时内容。</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>我已核对 {owner?.name ?? '未选账户'} 的策略适用日期、完整条件和勾选提醒</label>
    </div>
    <div className="modal-actions"><button className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={!owner || !confirmed || !preview || !(preview.addedTasks + preview.addedAlerts)} onClick={() => {
      if (!parsed.pack) return;
      try { onImport(parsed.pack, choices, userId); } catch (error) { setError((error as Error).message); setConfirmed(false); }
    }}>确认导入策略</button></div>
  </section></div>;
}
