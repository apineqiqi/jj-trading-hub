import type { AlertDirection, DailyWorkflow, PriceAlert, WatchItem, WorkflowPhase } from '../types/market';
import { taskKey } from './chatTasks.js';

export interface StrategyTask { phase: WorkflowPhase; title: string; detail: string; alert: { symbol: string; name: string; direction: AlertDirection; target: number } | null }
export interface StrategyPackage { format: 'jj-strategy-v1'; date: string; title: string; tasks: StrategyTask[] }
export interface StrategySelection { task: boolean; alert: boolean }
export interface StrategyParseResult { pack: StrategyPackage; normalized: string; repairs: string[] }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const exact = (v: Record<string, unknown>, fields: string[]) => Object.keys(v).every(key => fields.includes(key));
export const localDay = () => new Date().toLocaleDateString('sv-SE');

export function strategyPrompt(date: string) {
  return `请把本次已确认的策略整理为 JJ 交易中枢 JSON，只输出一个 JSON 对象，不要补造价格或自动形成交易建议。适用日期为 ${date}，若原策略不适用于该日，请先告知我，不要转换。
格式严格如下（tasks 可有多项）：
{"format":"jj-strategy-v1","date":"${date}","title":"对话名称","tasks":[{"phase":"pre","title":"检查事项","detail":"保留完整触发、失效、仓位限制和待确认事项","alert":null}]}
必须输出可被 JSON.parse 直接解析的标准 JSON：字段名和字符串边界只使用英文半角双引号（U+0022），不要使用中文弯引号；正文需要引用词语时使用中文弯引号“”。
phase 仅使用 pre（盘前）、live（盘中）、close（收盘）。所有任务都保留完整条件，标题简短。不确定信息在 detail 中写待确认。
只有对话明确给出了单一、精确的 A 股价格提醒条件时，alert 才可为 {"symbol":"六位代码","name":"标的名称","direction":"above","target":数值}；above 表示达到或高于，below 表示达到或低于。突破用 above，回踩或下破用 below，但不得自行推断方向。价格区间、未确认价位或含量能等复合条件时，保留完整条件在 detail，alert 使用 null；不能把复杂条件简化成价格触发。多个明确价位分为多项任务。不要提供 userId、数量、下单指令或其他字段。`;
}

function unwrapStrategy(raw: string) {
  return raw.replace(/^\uFEFF/, '').trim().replace(/^```(?:json)?[ \t]*(?:\r?\n)?([\s\S]*?)(?:\r?\n)?```$/i, '$1').trim();
}

function nextSignificant(source: string, from: number) {
  for (let i = from; i < source.length; i++) if (!/\s/.test(source[i])) return source[i];
  return '';
}

export function normalizeStrategyJson(source: string) {
  let normalized = '';
  let inString = false;
  let delimiter: 'straight' | 'curly' | null = null;
  let escaped = false;
  let smartQuotes = 0;
  let fullWidthPunctuation = 0;
  const punctuation: Record<string, string> = { '：': ':', '，': ',', '｛': '{', '｝': '}', '［': '[', '］': ']' };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (delimiter === 'straight') {
        normalized += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') { inString = false; delimiter = null; }
        continue;
      }
      if (char === '”' && [':', ',', '}', ']', '：', '，', '｝', '］', ''].includes(nextSignificant(source, i + 1))) {
        normalized += '"'; smartQuotes++; inString = false; delimiter = null;
      } else if (char === '"') {
        normalized += escaped ? char : '\\"'; escaped = false;
      } else {
        normalized += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
      }
      continue;
    }
    if (char === '"') { normalized += char; inString = true; delimiter = 'straight'; escaped = false; }
    else if (char === '“' || char === '”') { normalized += '"'; smartQuotes++; inString = true; delimiter = 'curly'; escaped = false; }
    else if (punctuation[char]) { normalized += punctuation[char]; fullWidthPunctuation++; }
    else normalized += char;
  }

  const repairs: string[] = [];
  if (smartQuotes) repairs.push(`${smartQuotes} 个中文结构引号`);
  if (fullWidthPunctuation) repairs.push(`${fullWidthPunctuation} 个全角结构标点`);
  return { normalized, repairs };
}

function syntaxError(error: unknown, source: string) {
  const message = error instanceof Error ? error.message : '';
  let position = message.match(/position\s+(\d+)/i)?.[1];
  let line = Number(message.match(/line\s+(\d+)/i)?.[1]);
  let column = Number(message.match(/column\s+(\d+)/i)?.[1]);
  if (position === undefined) {
    const token = message.match(/Unexpected token\s+'([^']+)'/i)?.[1];
    position = String(token ? Math.max(0, source.indexOf(token)) : source.length);
  }
  if (position !== undefined && (!line || !column)) {
    const before = source.slice(0, Number(position));
    line = before.split('\n').length;
    column = before.length - before.lastIndexOf('\n');
  }
  const location = line && column ? `（第 ${line} 行，第 ${column} 列附近）` : '';
  return new Error(`JSON 语法错误${location}：请检查引号、逗号和括号；也可重新复制 AI 整理提示词生成`);
}

export function parseStrategyInput(raw: string): StrategyParseResult {
  if (raw.length > 500_000) throw new Error('内容超过 500KB，请只粘贴本次策略');
  const clean = unwrapStrategy(raw);
  const repaired = normalizeStrategyJson(clean);
  let value: unknown;
  try { value = JSON.parse(repaired.normalized); } catch (error) { throw syntaxError(error, repaired.normalized); }
  if (!object(value) || !exact(value, ['format', 'date', 'title', 'tasks']) || value.format !== 'jj-strategy-v1' || !text(value.title) || !text(value.date) || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(Date.parse(value.date)) || new Date(value.date).toISOString().slice(0, 10) !== value.date || !Array.isArray(value.tasks) || !value.tasks.length || value.tasks.length > 200) throw new Error('策略格式不符：需要格式标记、有效日期、名称和 1–200 项任务');
  const tasks = value.tasks.map((row: unknown, i): StrategyTask => {
    const fail = () => new Error(`第 ${i + 1} 项字段无效：核对阶段、标题、完整详情及 alert（没有明确价格条件请填 null）`);
    if (!object(row) || !exact(row, ['phase', 'title', 'detail', 'alert']) || !['pre', 'live', 'close'].includes(String(row.phase)) || !text(row.title) || !text(row.detail)) throw fail();
    const a = row.alert;
    if (a !== null && (!object(a) || !exact(a, ['symbol', 'name', 'direction', 'target']) || typeof a.symbol !== 'string' || !/^\d{6}$/.test(a.symbol) || !text(a.name) || !['above', 'below'].includes(String(a.direction)) || typeof a.target !== 'number' || !Number.isFinite(a.target) || a.target <= 0)) throw fail();
    return { phase: row.phase as WorkflowPhase, title: row.title.trim(), detail: row.detail.trim(), alert: a === null ? null : { symbol: (a as Record<string, unknown>).symbol as string, name: ((a as Record<string, unknown>).name as string).trim(), direction: (a as Record<string, unknown>).direction as AlertDirection, target: (a as Record<string, unknown>).target as number } };
  });
  return { pack: { format: 'jj-strategy-v1', date: value.date, title: value.title.trim(), tasks }, normalized: repaired.normalized, repairs: repaired.repairs };
}

export function parseStrategy(raw: string): StrategyPackage {
  return parseStrategyInput(raw).pack;
}

export function reminderIssue(task: StrategyTask, userId: string, watchlist: WatchItem[]) {
  if (!task.alert) return '无明确价格条件，仅导入任务';
  const item = watchlist.find(item => item.userId === userId && item.symbol === task.alert!.symbol);
  if (!item) return '该账户观察池无此代码，请先添加标的';
  if (item.name.trim() !== task.alert.name) return '代码与观察池名称不一致，请核对后修正';
  return '';
}
const priceKey = (a: { userId: string; symbol: string; direction: AlertDirection; target: number }) => JSON.stringify([a.userId, a.symbol, a.direction, a.target]);

export function prepareStrategy(pack: StrategyPackage, selections: StrategySelection[], userId: string, workflows: DailyWorkflow[], alerts: PriceAlert[], watchlist: WatchItem[], today = localDay()) {
  if (pack.date !== today) throw new Error(`策略日期为 ${pack.date}，只允许导入今天 ${today} 的策略；请先重新复核适用日期`);
  if (!userId) throw new Error('请选择具体账户');
  const record = workflows.find(item => item.userId === userId && item.date === today) ?? { id: `${userId}-${today}`, userId, date: today, checks: {}, notes: {}, customTasks: [], updatedAt: '' };
  const tasks = [...(record.customTasks ?? [])]; const nextAlerts = [...alerts];
  const taskKeys = new Set(tasks.map(taskKey)); const alertKeys = new Set(alerts.map(priceKey));
  let addedTasks = 0, addedAlerts = 0, skippedTasks = 0, skippedAlerts = 0;
  const now = new Date().toISOString();
  pack.tasks.forEach((task, index) => {
    const choice = selections[index];
    if (choice?.task) {
      const key = taskKey(task);
      if (taskKeys.has(key)) skippedTasks++;
      else { tasks.push({ id: 'chat-' + crypto.randomUUID(), phase: task.phase, title: task.title, detail: task.detail, sourceTitle: pack.title, importedAt: now }); taskKeys.add(key); addedTasks++; }
    }
    if (choice?.alert && task.alert) {
      const issue = reminderIssue(task, userId, watchlist); if (issue) throw new Error(issue);
      const key = priceKey({ ...task.alert, userId });
      if (alertKeys.has(key)) skippedAlerts++;
      else { nextAlerts.push({ ...task.alert, id: crypto.randomUUID(), userId, label: `${task.title}：${task.detail}`, sourceTitle: pack.title, enabled: true, acknowledged: false, createdAt: now }); alertKeys.add(key); addedAlerts++; }
    }
  });
  const nextRecord = { ...record, customTasks: tasks, updatedAt: now };
  return { workflows: addedTasks ? workflows.some(item => item.id === record.id) ? workflows.map(item => item.id === record.id ? nextRecord : item) : [...workflows, nextRecord] : workflows, alerts: nextAlerts, addedTasks, addedAlerts, skippedTasks, skippedAlerts };
}

// Write both datasets before updating React state; on failure retain the source preview.
export function persistStrategy(workflows: DailyWorkflow[], alerts: PriceAlert[]) {
  const entries = [['jj-trading-v07-workflows', JSON.stringify(workflows)], ['jj-trading-v08-alerts', JSON.stringify(alerts)]];
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)] as const);
  try { entries.forEach(([key, value]) => localStorage.setItem(key, value)); }
  catch {
    let rolledBack = true;
    previous.forEach(([key, value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { rolledBack = false; } });
    throw new Error(rolledBack ? '写入失败，已回退原数据。请保留策略原文并检查存储空间' : '写入失败且回退未完整完成，请勿刷新；保留原文并从资金与备份导出当前页面数据');
  }
}
