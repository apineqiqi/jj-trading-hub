import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTasks, parseExport, taskKey } from '../.test-build/data/chatTasks.js';
import { parseBackup, restoreBackup } from '../.test-build/data/backup.js';
import { createPlanAlerts, linkedToPlan } from '../.test-build/data/planAlerts.js';

const plan = { id: 'plan1', userId: 'jj', symbol: '600001', name: '测试', entry: 10, stop: 9, target: 12, shares: 100, riskAmount: 100, capital: 1000, rewardRiskRatio: 2, createdAt: '2026-09-08T00:00:00Z' };
test('plan rules use explicit entry direction, independent price boundaries and stable dedupe', () => {
  const rules = createPlanAlerts(plan, 'below', []);
  assert.deepEqual(rules.map(r => [r.planLevel, r.direction, r.target]), [['entry', 'below', 10], ['stop', 'below', 9], ['target', 'above', 12]]);
  rules[0].enabled = false; rules[0].acknowledged = true;
  assert.deepEqual(createPlanAlerts(plan, 'above', rules), []);
  assert.equal(rules[0].enabled, false);
  assert.equal(createPlanAlerts(plan, 'above', rules.slice(1))[0].direction, 'above');
  assert.equal(createPlanAlerts({ ...plan, userId: 'alice' }, 'above', rules).length, 3);
  assert.equal(linkedToPlan(rules[0], { ...plan, userId: 'alice' }), false);
  assert.throws(() => createPlanAlerts({ ...plan, stop: 11 }, 'above', []));
  assert.throws(() => createPlanAlerts({ ...plan, entry: Infinity }, 'above', []));
});

test('V1.3 backups preserve linked rules and reject orphan, cross-account and duplicate links', () => {
  const data = fixture(); data['jj-trading-v10-risk-plans'] = [plan]; data['jj-trading-v08-alerts'] = createPlanAlerts(plan, 'above', []);
  const v13 = value => JSON.stringify({ app: 'jj-trading-hub', version: 13, createdAt: plan.createdAt, data: value });
  assert.deepEqual(parseBackup(v13(data)).data, data);
  assert.throws(() => parseBackup(v13({ ...data, 'jj-trading-v10-risk-plans': [] })), /来源无效/);
  assert.throws(() => parseBackup(v13({ ...data, 'jj-trading-v10-risk-plans': [{ ...plan, symbol: '600002' }] })), /来源无效/);
  assert.throws(() => parseBackup(v13({ ...data, 'jj-trading-v08-alerts': [...data['jj-trading-v08-alerts'], { ...data['jj-trading-v08-alerts'][0], id: 'duplicate' }] })), /重复/);
});

test('conversation import selects only the current branch and retains roles', () => {
  const node = (id, parent, text, role = 'assistant') => ({ parent, message: { id, author: { role }, content: { parts: [text] } } });
  const [conversation] = parseExport(JSON.stringify([{ title: '分支测试', current_node: 'new', mapping: { root: node('root', null, '请分析', 'user'), old: node('old', 'root', '旧结论'), new: node('new', 'root', '最新结论') } }]));
  assert.deepEqual(conversation.messages.map(m => m.text), ['请分析', '最新结论']);
  assert.equal(conversation.messages[0].role, 'user');
});
test('import retains long conditions, assigns phases, and does not truncate at 18 tasks', () => {
  const long = '必须确认量价条件'.repeat(35);
  const items = extractTasks(`## 盘前\n1. 检查持仓：${long}\n## 盘中\n2. 观察触发价格\n## 收盘\n3. 记录执行结果\n${Array.from({ length: 20 }, (_, i) => `- 记录第 ${i} 个观察项`).join('\n')}`, 'live');
  assert.equal(items.length, 23);
  assert.equal(items[0].detail, long);
  assert.deepEqual(items.slice(0, 3).map(t => t.phase), ['pre', 'live', 'close']);
});
test('dedupe preserves different details and different phases', () => {
  const items = extractTasks('## 盘前\n- 检查价格：条件 A\n- 检查价格：条件 A\n- 检查价格：条件 B\n## 盘中\n- 检查价格：条件 A', 'pre');
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map(taskKey)).size, 3);
});
test('short numbered action lines are not mistaken for phase headings', () => {
  assert.equal(extractTasks('1. 确认开盘量价是否匹配\n2. 记录盘中偏离计划的原因\n3. 收盘复盘执行纪律', 'pre').length, 3);
  assert.equal(taskKey({ phase: 'pre', title: '检查风险', detail: '' }), taskKey({ phase: 'pre', title: '检查风险', detail: '来自 ChatGPT 对话，执行前请复核条件与风险边界。' }));
});
function fixture() {
  return { 'jj-trading-v06-users': [{ id: 'jj', name: 'JJ', color: '#fff' }], 'jj-trading-v06-active-user': 'jj', 'jj-trading-v06-positions': [], 'jj-trading-v06-watchlist': [], 'jj-trading-v04-snapshots': [{ id: 'legacy', date: '2026-09-03', totalAssets: 100, marketValue: 80, cash: 20, unrealizedPnl: 0 }], 'jj-trading-v04-trades': [], 'jj-trading-privacy-mode': false, 'jj-trading-v07-workflows': [], 'jj-trading-v08-alerts': [], 'jj-trading-v09-visual-reviews': [], 'jj-trading-v10-risk-profiles': [], 'jj-trading-v10-risk-plans': [], 'jj-trading-v12-cash': { jj: 20 } };
}
const wrap = data => JSON.stringify({ app: 'jj-trading-hub', version: 12, createdAt: '2026-09-08T00:00:00Z', data });
test('backup roundtrip preserves legacy records and rejects incomplete or foreign records', () => {
  const data = fixture();
  assert.deepEqual(parseBackup(wrap(data)).data, data);
  assert.throws(() => parseBackup(wrap({ ...data, 'jj-trading-v04-trades': [{ userId: 'missing' }] })));
  delete data['jj-trading-v12-cash'];
  assert.throws(() => parseBackup(wrap(data)));
});
test('restore write failure rolls back every previously written value', () => {
  const data = fixture();
  const initial = new Map(Object.keys(data).map(key => [key, 'old-' + key]));
  const state = new Map(initial);
  let writes = 0;
  globalThis.localStorage = { getItem: key => state.get(key) ?? null, setItem: (key, value) => { if (++writes === 5) throw new Error('quota'); state.set(key, value); }, removeItem: key => state.delete(key) };
  assert.throws(() => restoreBackup(data), /已保留原数据/);
  assert.deepEqual(state, initial);
  restoreBackup(data);
  assert.deepEqual(JSON.parse(state.get('jj-trading-v12-cash')), { jj: 20 });
});
