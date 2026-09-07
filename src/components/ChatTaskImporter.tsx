import { Check, FileJson, FileText, LockKeyhole, MessageSquareText, Sparkles, Upload, X } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import type { WorkflowPhase, WorkflowTask } from '../types/market';

type SourceMode = 'export' | 'paste';
type JsonObject = Record<string, unknown>;

interface ConversationOption {
  id: string;
  title: string;
  updatedAt?: number;
  text: string;
}

interface CandidateTask {
  id: string;
  title: string;
  detail: string;
  selected: boolean;
}

const phaseNames: Record<WorkflowPhase, string> = { pre: '盘前', live: '盘中', close: '收盘' };
const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function conversationText(value: JsonObject) {
  const mapping = isObject(value.mapping) ? value.mapping : {};
  return Object.values(mapping)
    .map(node => {
      if (!isObject(node) || !isObject(node.message)) return null;
      const message = node.message;
      const content = isObject(message.content) ? message.content : {};
      const parts = Array.isArray(content.parts) ? content.parts.filter((part): part is string => typeof part === 'string') : [];
      return { time: typeof message.create_time === 'number' ? message.create_time : 0, text: parts.join('\n') };
    })
    .filter((item): item is { time: number; text: string } => Boolean(item?.text))
    .sort((a, b) => a.time - b.time)
    .map(item => item.text)
    .join('\n');
}

function parseExport(raw: string): ConversationOption[] {
  const parsed: unknown = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.filter(isObject).map((item, index) => ({
    id: typeof item.id === 'string' ? item.id : `conversation-${index}`,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `未命名对话 ${index + 1}`,
    updatedAt: typeof item.update_time === 'number' ? item.update_time : undefined,
    text: conversationText(item),
  })).filter(item => item.text.trim()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function cleanTask(value: string) {
  return value
    .replace(/^\s*(?:[-*•]|\[[ xX]\]|\d+[.)、]|[一二三四五六七八九十]+[、.])\s*/, '')
    .replace(/[*_`#>]/g, '')
    .replace(/^任务\s*[：:]\s*/, '')
    .trim();
}

function splitTask(value: string) {
  const cleaned = cleanTask(value).replace(/[。；;]+$/, '');
  const separator = cleaned.search(/[：:]/);
  if (separator > 1 && separator < 32) return { title: cleaned.slice(0, separator).trim(), detail: cleaned.slice(separator + 1).trim() };
  const comma = cleaned.search(/[，,]/);
  if (comma > 5 && comma < 34) return { title: cleaned.slice(0, comma).trim(), detail: cleaned.slice(comma + 1).trim() };
  return { title: cleaned.slice(0, 54), detail: cleaned.length > 54 ? cleaned.slice(54, 140) : '来自 ChatGPT 对话，执行前请复核条件与风险边界。' };
}

function extractTasks(text: string): CandidateTask[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const marked = lines.filter(line => /^(?:[-*•]|\[[ xX]\]|\d+[.)、]|[一二三四五六七八九十]+[、.])\s*/.test(line));
  const actionWords = /检查|确认|观察|记录|执行|复盘|同步|更新|设置|等待|控制|完成|核对|判断|跟踪|止损|减仓|加仓/;
  const fallback = text.split(/[。！？!?\n]+/).map(item => item.trim()).filter(item => actionWords.test(item));
  const source = marked.length ? marked : fallback;
  const seen = new Set<string>();
  return source.map(cleanTask).filter(item => item.length >= 4 && item.length <= 180).filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 18).map((item, index) => ({ id: `candidate-${index}`, ...splitTask(item), selected: true }));
}

export function ChatTaskImporter({ initialPhase, onClose, onImport }: {
  initialPhase: WorkflowPhase;
  onClose: () => void;
  onImport: (tasks: WorkflowTask[]) => void;
}) {
  const [mode, setMode] = useState<SourceMode>('export');
  const [phase, setPhase] = useState<WorkflowPhase>(initialPhase);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pasteTitle, setPasteTitle] = useState('ChatGPT 盘面分析');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const selectedConversation = conversations.find(item => item.id === selectedId);
  const sourceTitle = mode === 'export' ? selectedConversation?.title ?? '' : pasteTitle.trim() || 'ChatGPT 对话';
  const sourceText = mode === 'export' ? selectedConversation?.text ?? '' : pasteText;
  const [selectionOverrides, setSelectionOverrides] = useState<Record<string, boolean>>({});
  const candidates = useMemo(() => extractTasks(sourceText).map(item => ({ ...item, selected: selectionOverrides[item.id] ?? item.selected })), [sourceText, selectionOverrides]);
  const selectedCount = candidates.filter(item => item.selected).length;

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = parseExport(await file.text());
      if (!parsed.length) throw new Error('没有找到可读取的对话');
      setConversations(parsed);
      setSelectedId(parsed[0].id);
      setSelectionOverrides({});
    } catch {
      setError('无法读取该文件。请选择 ChatGPT 数据导出中的 conversations.json。');
    }
    event.target.value = '';
  };

  const submit = () => {
    const tasks = candidates.filter(item => item.selected).map(item => ({
      id: `chat-${crypto.randomUUID()}`,
      phase,
      title: item.title,
      detail: item.detail,
      sourceTitle,
      importedAt: new Date().toISOString(),
    }));
    if (!tasks.length) return;
    onImport(tasks);
  };

  return <div className="modal-backdrop chat-import-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="modal chat-import-modal" role="dialog" aria-modal="true" aria-label="从 ChatGPT 对话导入任务">
      <div className="modal-head chat-import-head"><div><span className="eyebrow">CONVERSATION → EXECUTION</span><h3><MessageSquareText size={21}/>从 ChatGPT 对话导入任务</h3><p>选择一段对话，把其中的行动项转成当天可勾选的执行清单。</p></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>

      <div className="chat-import-modes">
        <button className={mode === 'export' ? 'active' : ''} onClick={() => { setMode('export'); setSelectionOverrides({}); }}><FileJson size={16}/><span><b>选择导出对话</b><small>读取 conversations.json</small></span></button>
        <button className={mode === 'paste' ? 'active' : ''} onClick={() => { setMode('paste'); setSelectionOverrides({}); }}><FileText size={16}/><span><b>粘贴单段对话</b><small>适合快速导入本次分析</small></span></button>
      </div>

      <div className="chat-import-grid">
        <div className="chat-source-panel">
          <div className="chat-step"><span>01</span><b>选择内容来源</b></div>
          {mode === 'export' ? <>
            <label className="chat-file-drop"><input type="file" accept=".json,application/json" onChange={event => void loadFile(event)}/><Upload size={20}/><b>{conversations.length ? `已读取 ${conversations.length} 段对话` : '选择 conversations.json'}</b><span>文件只在当前浏览器中读取</span></label>
            <p className="chat-export-help">获取文件：ChatGPT 设置 → 数据控制 → 导出数据，解压后选择 conversations.json。</p>
            {conversations.length > 0 && <label className="chat-conversation-select"><span>对话</span><select value={selectedId} onChange={event => { setSelectedId(event.target.value); setSelectionOverrides({}); }}>{conversations.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
          </> : <div className="chat-paste-fields"><label><span>对话名称</span><input value={pasteTitle} onChange={event => setPasteTitle(event.target.value)} placeholder="例如：9 月 7 日盘中分析"/></label><label><span>对话内容</span><textarea value={pasteText} onChange={event => { setPasteText(event.target.value); setSelectionOverrides({}); }} placeholder="粘贴 ChatGPT 回复或完整对话；编号、项目符号和行动句会被识别为任务。"/></label></div>}
          {error && <div className="form-error">{error}</div>}
          <div className="chat-local-note"><LockKeyhole size={14}/><span><b>本地解析</b>原始对话不会上传到服务器，也不会自动执行交易。</span></div>
        </div>

        <div className="chat-preview-panel">
          <div className="chat-step"><span>02</span><b>选择阶段与任务</b></div>
          <div className="chat-phase-select">{(['pre', 'live', 'close'] as WorkflowPhase[]).map(item => <button key={item} className={phase === item ? 'active' : ''} onClick={() => setPhase(item)}>{phaseNames[item]}</button>)}</div>
          <div className="chat-preview-head"><span>{sourceTitle || '等待选择对话'}</span><b>{selectedCount} / {candidates.length} 项</b></div>
          {candidates.length ? <div className="chat-candidates">{candidates.map(task => <label key={task.id} className={task.selected ? 'selected' : ''}><input type="checkbox" checked={task.selected} onChange={event => setSelectionOverrides(current => ({ ...current, [task.id]: event.target.checked }))}/><span className="chat-candidate-check">{task.selected && <Check size={13}/>}</span><span><b>{task.title}</b><small>{task.detail}</small></span></label>)}</div> : <div className="chat-candidate-empty"><Sparkles size={25}/><b>等待识别行动项</b><span>优先识别编号清单、项目符号和包含“确认、检查、执行、记录”等动词的句子。</span></div>}
        </div>
      </div>

      <div className="modal-actions chat-import-actions"><span>将写入 {phaseNames[phase]}清单 · 导入后仍可逐项勾选</span><button className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={!selectedCount} onClick={submit}><Sparkles size={15}/>导入 {selectedCount || ''} 项任务</button></div>
    </section>
  </div>;
}
