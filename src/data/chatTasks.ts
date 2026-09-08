import type { WorkflowPhase } from '../types/market';
type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
export interface ChatMessage { id: string; role: string; text: string }
export interface ConversationOption { id: string; title: string; updatedAt: number; messages: ChatMessage[] }
export interface CandidateTask { id: string; title: string; detail: string; phase: WorkflowPhase; selected: boolean }
export const taskKey = (task: { phase: WorkflowPhase; title: string; detail: string }) => {
  const detail = task.detail === '来自 ChatGPT 对话，执行前请复核条件与风险边界。' ? '' : task.detail;
  return `${task.phase}:${task.title.trim().toLowerCase().replace(/\s+/g, ' ')}:${detail.trim().toLowerCase().replace(/\s+/g, ' ')}`;
};
export function parseExport(raw: string): ConversationOption[] {
  const parsed: unknown = JSON.parse(raw);
  return (Array.isArray(parsed) ? parsed : [parsed]).filter(obj).map((item, index) => {
    const mapping = obj(item.mapping) ? item.mapping : {};
    const nodes: Obj[] = [];
    if (typeof item.current_node === 'string' && obj(mapping[item.current_node])) {
      const visited = new Set<string>();
      let id: unknown = item.current_node;
      while (typeof id === 'string' && !visited.has(id) && obj(mapping[id])) {
        visited.add(id); const node = mapping[id] as Obj;
        nodes.unshift(node); id = node.parent;
      }
    } else {
      nodes.push(...Object.values(mapping).filter(obj).sort((a, b) => Number(obj(a.message) ? a.message.create_time ?? 0 : 0) - Number(obj(b.message) ? b.message.create_time ?? 0 : 0)));
    }
    const messages = nodes.flatMap((node, i) => {
      if (!obj(node.message)) return [];
      const m = node.message;
      const role = obj(m.author) ? String(m.author.role ?? '') : '';
      if (role !== 'assistant' && role !== 'user') return [];
      const content = obj(m.content) ? m.content : {};
      const text = Array.isArray(content.parts) ? content.parts.filter((part): part is string => typeof part === 'string').join('\n') : '';
      return text.trim() ? [{ id: typeof m.id === 'string' ? m.id : `message-${i}`, role, text }] : [];
    });
    return { id: typeof item.id === 'string' ? item.id : `conversation-${index}`, title: typeof item.title === 'string' ? item.title : `未命名对话 ${index + 1}`, updatedAt: typeof item.update_time === 'number' ? item.update_time : 0, messages };
  }).filter(item => item.messages.length).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function extractTasks(text: string, initialPhase: WorkflowPhase): CandidateTask[] {
  const output: CandidateTask[] = [];
  let phase = initialPhase; let inCode = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (!line || inCode) continue;
    const clean = line.replace(/^\s*(?:[-*•]\s*\[[ xX]\]|[-*•]|\[[ xX]\]|\d+[.)、]|[一二三四五六七八九十]+[、.])\s*/, '').replace(/[*_`#>]/g, '').trim();
    const marked = /^(?:[-*•]|\[[ xX]\]|\d+[.)、]|[一二三四五六七八九十]+[、.])/.test(line);
    if (!marked && (line.startsWith('#') || /^(盘前|开盘|盘中|收盘)(任务|计划|清单|阶段|预案|复盘)?[：:]?$/.test(clean)) && /盘前|开盘|盘中|收盘/.test(clean)) {
      phase = /收盘/.test(clean) ? 'close' : /盘中/.test(clean) ? 'live' : 'pre';
      if (clean.length < 20) continue;
    }
    const action = /检查|确认|观察|记录|执行|复盘|同步|更新|设置|等待|控制|完成|核对|判断|跟踪|止损|减仓|加仓/.test(clean);
    if ((marked || action) && clean.length >= 4) {
      const separator = clean.search(/[：:]/);
      const splitAt = separator > 1 && separator < 54 ? separator : clean.length > 54 ? 54 : -1;
      output.push({ id: `candidate-${output.length}`, title: splitAt < 0 ? clean : clean.slice(0, splitAt), detail: splitAt < 0 ? '' : clean.slice(splitAt + (splitAt === separator ? 1 : 0)).trim(), phase, selected: true });
    } else if (output.length && /^\s+/.test(raw)) {
      output[output.length - 1].detail += `${output[output.length - 1].detail ? '\n' : ''}${clean}`;
    }
  }
  const seen = new Set<string>();
  return output.filter(task => { const key = taskKey(task); if (seen.has(key)) return false; seen.add(key); return true; });
}
