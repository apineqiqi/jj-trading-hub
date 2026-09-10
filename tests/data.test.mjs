import test from 'node:test';
import assert from 'node:assert/strict';
import { closeAccount, closePositions, closeTrade, appendCloseTrade } from '../.test-build/data/close20260909.js';

test('September 9 evidence reconciles positions and cash without inventing fees', () => {
  assert.equal(closePositions.reduce((sum, p) => sum + p.shares * p.price, 0), closeAccount.marketValue);
  assert.equal(closeAccount.marketValue + closeAccount.availableCash, closeAccount.totalAssets);
  assert.equal(closeTrade.price, 316.045);
  assert.equal(closeTrade.shares + closePositions[0].shares, 2200);
  assert.equal(closeTrade.fee, undefined);
  const first = appendCloseTrade([]);
  assert.deepEqual(appendCloseTrade(first), first);
  const existing = [{ ...closeTrade, id: 'manual-record', fee: 70 }];
  assert.deepEqual(appendCloseTrade(existing), existing);
  assert.equal(appendCloseTrade([{ ...closeTrade, id: 'other', userId: 'other' }]).length, 2);
});

test('backup preserves unknown fees and rejects malformed fee values', () => {
  const data = fixture();
  data['jj-trading-v04-trades'] = [{ ...closeTrade, userId: 'jj' }];
  const wrap = () => JSON.stringify({ app: 'jj-trading-hub', version: 15, createdAt: '2026-09-09T09:21:00Z', data });
  assert.equal(parseBackup(wrap()).data['jj-trading-v04-trades'][0].fee, undefined);
  data['jj-trading-v04-trades'][0].fee = 'unknown';
  assert.throws(() => parseBackup(wrap()));
});
import { extractTasks, parseExport, taskKey } from '../.test-build/data/chatTasks.js';
import { parseBackup, restoreBackup } from '../.test-build/data/backup.js';
import { createPlanAlerts, linkedToPlan } from '../.test-build/data/planAlerts.js';
import { parseStrategy, parseStrategyInput, prepareStrategy, persistStrategy, reminderIssue } from '../.test-build/data/strategyImport.js';
import { createStrategyRecord } from '../.test-build/data/strategyRecords.js';

const strategy = { format: 'jj-strategy-v1', date: '2026-09-08', title: '策略测试', tasks: [
  { phase: 'pre', title: '核对条件', detail: '等待确认，不自行补价格。', alert: null },
  { phase: 'live', title: '观察明确价位', detail: '仅价格提示，执行前核对持仓。'.repeat(30), alert: { symbol: '600001', name: '测试', direction: 'above', target: 10 } },
] };
const strategyWatch = [{ userId: 'jj', symbol: '600001', name: '测试' }];
test('strategy parser accepts fenced JSON, preserves conditions and rejects ambiguous or extra fields', () => {
  assert.deepEqual(parseStrategy('```json\n' + JSON.stringify(strategy) + '\n```'), strategy);
  for (const alert of [{ ...strategy.tasks[1].alert, target: '10-12' }, { ...strategy.tasks[1].alert, target: 0 }, { ...strategy.tasks[1].alert, direction: 'buy' }, { ...strategy.tasks[1].alert, symbol: 600001 }]) {
    assert.throws(() => parseStrategy(JSON.stringify({ ...strategy, tasks: [{ ...strategy.tasks[1], alert }] })));
  }
  assert.throws(() => parseStrategy(JSON.stringify({ ...strategy, userId: 'injected' })));
  assert.throws(() => parseStrategy(JSON.stringify({ ...strategy, date: '2026-02-30' })));
});
test('strategy parser repairs smart JSON boundaries without changing quoted Chinese content', () => {
  const smart = '{“format”:“jj-strategy-v1”，“date”:“2026-09-09”，“title”:“格式修复”，“tasks”:[{“phase”:“live”，“title”:“检查联动”，“detail”:“核对“明显强势”和“明显走弱”的标准。”，“alert”:null}]}';
  const result = parseStrategyInput(smart);
  assert.equal(result.pack.tasks[0].detail, '核对“明显强势”和“明显走弱”的标准。');
  assert.match(result.normalized, /{"format":"jj-strategy-v1","date"/);
  assert.deepEqual(result.repairs, ['28 个中文结构引号', '6 个全角结构标点']);
  assert.match(JSON.stringify(result.pack), /明显强势/);
  assert.throws(() => parseStrategy('{"format":}'), /第 1 行.*第 \d+ 列/);
});
test('strategy import separates opt-in alerts and tasks and preserves paused duplicate rules', () => {
  const choices = [{ task: true, alert: false }, { task: true, alert: true }];
  const first = prepareStrategy(strategy, choices, 'jj', [], [], strategyWatch, strategy.date, { strategyId: 'strategy-1', importedAt: '2026-09-08T01:02:03Z' });
  assert.equal(first.addedTasks, 2); assert.equal(first.addedAlerts, 1);
  assert.equal(first.workflows[0].customTasks[1].detail, strategy.tasks[1].detail);
  assert.deepEqual(first.links.map(link => [link.task.outcome, link.alert.outcome]), [['created', 'not-applicable'], ['created', 'created']]);
  assert.equal(first.workflows[0].customTasks[0].strategyId, 'strategy-1');
  assert.equal(first.workflows[0].customTasks[1].sourceTaskIndex, 1);
  assert.equal(first.alerts[0].strategyId, 'strategy-1');
  assert.equal(first.alerts[0].sourceTaskIndex, 1);
  first.alerts[0].enabled = false;
  const second = prepareStrategy(strategy, choices, 'jj', first.workflows, first.alerts, strategyWatch, strategy.date);
  assert.equal(second.addedTasks + second.addedAlerts, 0);
  assert.equal(second.alerts[0].enabled, false);
  const onlyTasks = prepareStrategy(strategy, choices.map(c => ({ ...c, alert: false })), 'jj', [], [], [], strategy.date);
  assert.equal(onlyTasks.addedAlerts, 0); assert.equal(onlyTasks.addedTasks, 2);
  const other = prepareStrategy(strategy, choices, 'alice', first.workflows, first.alerts, [{ ...strategyWatch[0], userId: 'alice' }], strategy.date);
  assert.equal(other.addedTasks, 2); assert.equal(other.addedAlerts, 1);
  assert.throws(() => prepareStrategy(strategy, choices, 'jj', [], [], strategyWatch, '2026-09-09'), /策略日期/);
  assert.match(reminderIssue(strategy.tasks[1], 'alice', strategyWatch), /观察池/);
  assert.match(reminderIssue(strategy.tasks[1], 'jj', [{ ...strategyWatch[0], name: '不匹配' }]), /不一致/);
});
test('strategy multi-key storage failure rolls back instead of importing half a package', () => {
  const initial = new Map([['jj-trading-v07-workflows', 'old-workflows'], ['jj-trading-v08-alerts', 'old-alerts'], ['jj-trading-v16-strategies', 'old-strategies']]);
  for (const failAt of [1, 2, 3]) {
    const state = new Map(initial); let writes = 0;
    globalThis.localStorage = { getItem: k => state.get(k) ?? null, setItem: (k, v) => { if (++writes === failAt) throw new Error('quota'); state.set(k, v); }, removeItem: k => state.delete(k) };
    assert.throws(() => persistStrategy([], [], []), /已回退/);
    assert.deepEqual(state, initial);
  }
});
test('V1.6 strategy record keeps an immutable snapshot and backup validates bidirectional provenance', () => {
  const data = fixture();
  const selections = [{ task: true, alert: false }, { task: true, alert: true }];
  const result = prepareStrategy(strategy, selections, 'jj', [], [], strategyWatch, strategy.date, { strategyId: 'strategy-1', importedAt: '2026-09-08T01:02:03Z' });
  const record = createStrategyRecord({ id: 'strategy-1', userId: 'jj', importedAt: '2026-09-08T01:02:03Z', pack: strategy, links: result.links, repairs: ['2 个中文结构引号'] });
  data['jj-trading-v07-workflows'] = result.workflows; data['jj-trading-v08-alerts'] = result.alerts;
  data['jj-trading-v16-strategies'] = [record];
  result.workflows[0].customTasks[0].title = '用户编辑后的标题';
  assert.equal(record.snapshot.tasks[0].title, '核对条件');
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: '2026-09-08T00:00:00Z', data })).data, data);
  const orphan = structuredClone(data); orphan['jj-trading-v07-workflows'][0].customTasks[0].strategyId = 'missing';
  assert.throws(() => parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: '2026-09-08T00:00:00Z', data: orphan })), /策略任务/);
  const crossAccount = structuredClone(data); crossAccount['jj-trading-v06-users'].push({ id: 'alice', name: 'Alice', color: '#aaa' }); crossAccount['jj-trading-v16-strategies'][0].userId = 'alice';
  assert.throws(() => parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: '2026-09-08T00:00:00Z', data: crossAccount })), /策略任务/);
  const duplicate = structuredClone(data); duplicate['jj-trading-v16-strategies'].push(structuredClone(record));
  assert.throws(() => parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: '2026-09-08T00:00:00Z', data: duplicate })), /重复记录编号/);
});

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
  return { 'jj-trading-v06-users': [{ id: 'jj', name: 'JJ', color: '#fff' }], 'jj-trading-v06-active-user': 'jj', 'jj-trading-v06-positions': [], 'jj-trading-v06-watchlist': [], 'jj-trading-v04-snapshots': [{ id: 'legacy', date: '2026-09-03', totalAssets: 100, marketValue: 80, cash: 20, unrealizedPnl: 0 }], 'jj-trading-v04-trades': [], 'jj-trading-privacy-mode': false, 'jj-trading-v07-workflows': [], 'jj-trading-v08-alerts': [], 'jj-trading-v09-visual-reviews': [], 'jj-trading-v10-risk-profiles': [], 'jj-trading-v10-risk-plans': [], 'jj-trading-v12-cash': { jj: 20 }, 'jj-trading-v16-strategies': [] };
}
const wrap = data => JSON.stringify({ app: 'jj-trading-hub', version: 12, createdAt: '2026-09-08T00:00:00Z', data });
test('backup roundtrip preserves legacy records and rejects incomplete or foreign records', () => {
  const data = fixture();
  assert.deepEqual(parseBackup(wrap(data)).data, data);
  for (const version of [12, 13, 14, 15]) {
    const legacy = fixture(); delete legacy['jj-trading-v16-strategies'];
    assert.deepEqual(parseBackup(JSON.stringify({ app: 'jj-trading-hub', version, createdAt: '2026-09-08T00:00:00Z', data: legacy })).data['jj-trading-v16-strategies'], []);
  }
  const incompleteV16 = fixture(); delete incompleteV16['jj-trading-v16-strategies'];
  assert.throws(() => parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: '2026-09-08T00:00:00Z', data: incompleteV16 })));
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
