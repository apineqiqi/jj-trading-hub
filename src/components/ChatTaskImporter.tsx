import { useMemo, useState, type ChangeEvent } from 'react';
import { parseExport, extractTasks, taskKey, type CandidateTask, type ConversationOption } from '../data/chatTasks';
import type { WorkflowPhase, WorkflowTask } from '../types/market';

const phaseNames = { pre: '盘前', live: '盘中', close: '收盘' };
export function ChatTaskImporter({ initialPhase, existingTasks, onClose, onImport }: { initialPhase: WorkflowPhase; existingTasks: WorkflowTask[]; onClose: () => void; onImport: (tasks: WorkflowTask[]) => void }) {
  const [mode, setMode] = useState<'export' | 'paste'>('paste');
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [messageId, setMessageId] = useState('');
  const [search, setSearch] = useState('');
  const [pasteTitle, setPasteTitle] = useState('ChatGPT 盘面分析');
  const [pasteText, setPasteText] = useState('');
  const [edits, setEdits] = useState<Record<string, Partial<CandidateTask>>>({});
  const [error, setError] = useState('');
  const conversation = conversations.find(item => item.id === conversationId);
  const sourceText = mode === 'paste' ? pasteText : conversation?.messages.find(item => item.id === messageId)?.text ?? '';
  const sourceTitle = mode === 'paste' ? pasteTitle.trim() || 'ChatGPT 对话' : (conversation?.title ?? '') + ' · 消息 ' + ((conversation?.messages.findIndex(item => item.id === messageId) ?? -1) + 1);
  const candidates = useMemo(() => extractTasks(sourceText, initialPhase).map(item => ({ ...item, ...edits[item.id] })), [sourceText, initialPhase, edits]);
  const existing = new Set(existingTasks.map(taskKey));
  const seen = new Set<string>();
  const selected = candidates.filter(item => {
    if (!item.selected || !item.title.trim()) return false;
    const key = taskKey(item);
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const skipped = candidates.filter(item => item.selected && item.title.trim()).length - selected.length;
  const update = (id: string, next: Partial<CandidateTask>) => setEdits(current => ({ ...current, [id]: { ...current[id], ...next } }));
  const choose = (item?: ConversationOption) => {
    setConversationId(item?.id ?? '');
    setMessageId(item?.messages.filter(message => message.role === 'assistant').at(-1)?.id ?? item?.messages.at(-1)?.id ?? '');
    setEdits({});
  };
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setConversations([]); choose();
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50MB，请改用粘贴单段回复');
      const items = parseExport(await file.text());
      if (!items.length) throw new Error('未找到可读取的文字消息');
      setConversations(items); choose(items[0]);
    } catch (reason) { setError(reason instanceof SyntaxError ? '文件不是有效 JSON，请选择 conversations.json' : reason instanceof Error ? reason.message : '文件读取失败'); }
    event.target.value = '';
  };
  const submit = () => onImport(selected.map(item => ({ id: 'chat-' + crypto.randomUUID(), title: item.title.trim(), detail: item.detail.trim(), phase: item.phase, sourceTitle, importedAt: new Date().toISOString() })));
  return <div className="modal-backdrop chat-import-backdrop"><section className="modal chat-import-modal" role="dialog" aria-modal="true" aria-label="从 ChatGPT 对话导入任务">
    <div className="modal-head chat-import-head"><div><span className="eyebrow">CONVERSATION → EXECUTION · V1.2</span><h3>从 ChatGPT 对话导入任务</h3><p>选择具体回复，编辑任务和阶段后导入当天清单。</p></div><button className="ghost-btn" onClick={onClose}>关闭</button></div>
    <div className="chat-import-modes"><button className={mode === 'paste' ? 'active' : ''} onClick={() => { setMode('paste'); setEdits({}); }}>粘贴单段对话</button><button className={mode === 'export' ? 'active' : ''} onClick={() => { setMode('export'); setEdits({}); }}>选择导出对话</button></div>
    <div className="chat-import-grid"><div className="chat-source-panel">
      {mode === 'paste' ? <div className="chat-paste-fields"><label><span>对话名称</span><input value={pasteTitle} onChange={event => setPasteTitle(event.target.value)}/></label><label><span>对话内容</span><textarea value={pasteText} onChange={event => { setPasteText(event.target.value); setEdits({}); }} placeholder="粘贴具体回复；支持盘前、盘中、收盘标题和任务清单。"/></label></div> : <div className="chat-paste-fields"><label>选择 conversations.json<input type="file" accept=".json,application/json" onChange={event => void load(event)}/></label>{conversations.length > 0 && <><label>搜索对话<input value={search} onChange={event => setSearch(event.target.value)}/></label><label>对话<select value={conversationId} onChange={event => choose(conversations.find(item => item.id === event.target.value))}>{conversations.filter(item => item.id === conversationId || item.title.includes(search)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>选择消息<select value={messageId} onChange={event => { setMessageId(event.target.value); setEdits({}); }}>{conversation?.messages.map((message, index) => <option key={message.id} value={message.id}>{index + 1}. {message.role === 'assistant' ? 'ChatGPT' : '用户'}：{message.text.slice(0, 45)}</option>)}</select></label><details><summary>查看所选消息原文</summary><pre className="source-text">{sourceText}</pre></details></>}</div>}
      <p className="chat-export-help">导出模式默认选择当前对话分支的最新回复；也可手动选择其他消息。</p><p className="chat-local-note">文字只在当前浏览器解析。请在预览中核对完整条件。</p>{error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="chat-preview-panel"><div className="chat-preview-head"><b>识别 {candidates.length} 项 · 可导入 {selected.length} 项</b></div>{skipped > 0 && <p role="status">{skipped} 项重复任务将跳过（同阶段、标题及详情相同）。</p>}
      {candidates.length ? <div className="editable-candidates">{candidates.map((task, index) => <div className="editable-task" key={task.id}><div className="task-edit-heading"><label><input type="checkbox" aria-label={'选择任务 ' + (index + 1)} checked={task.selected} onChange={event => update(task.id, { selected: event.target.checked })}/>任务 {index + 1}</label><select aria-label={'任务 ' + (index + 1) + ' 阶段'} value={task.phase} onChange={event => update(task.id, { phase: event.target.value as WorkflowPhase })}>{Object.entries(phaseNames).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></div><input aria-label={'任务 ' + (index + 1) + ' 标题'} value={task.title} onChange={event => update(task.id, { title: event.target.value })}/><textarea aria-label={'任务 ' + (index + 1) + ' 详情'} value={task.detail} placeholder="触发条件、失效条件和补充说明" onChange={event => update(task.id, { detail: event.target.value })}/>{existing.has(taskKey(task)) && <small>当天此阶段已有相同任务</small>}</div>)}</div> : <p className="chat-candidate-empty">粘贴或选择回复后，这里将显示可编辑任务。</p>}
    </div></div><div className="modal-actions chat-import-actions"><span>按每条任务选择的阶段导入</span><button className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={!selected.length} onClick={submit}>导入 {selected.length} 项任务</button></div>
  </section></div>;
}
