import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5174/jj-trading-hub/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const importedAt = '2026-09-09T01:30:00.000Z';
const localDate = new Date().toLocaleDateString('sv-SE');
const jjTasks = [
  { phase: 'pre', title: '核对海外映射', detail: '确认隔夜映射仍然有效。', alert: null },
  { phase: 'live', title: '观察主支撑', detail: '只观察明确价格边界，不自动执行。', alert: { symbol: '600001', name: '测试标的', direction: 'below', target: 10 } },
  { phase: 'close', title: '复盘执行偏差', detail: '记录计划与实际执行的差异。', alert: null },
  { phase: 'close', title: '检查收盘结构', detail: '核对关键区间是否仍然有效。', alert: null },
  { phase: 'live', title: '核对修复条件', detail: '保留导入时的原始判断。', alert: null },
];
const strategies = [
  {
    id: 'strategy-jj-v1', seriesId: 'series-jj', version: 1, userId: 'user-jj', status: 'active', importedAt, repairs: [],
    snapshot: { format: 'jj-strategy-v1', date: localDate, title: 'JJ 波段策略', tasks: jjTasks },
    links: [
      { sourceIndex: 0, task: { outcome: 'created', id: 'task-v16-created' }, alert: { outcome: 'not-applicable' } },
      { sourceIndex: 1, task: { outcome: 'duplicate' }, alert: { outcome: 'created', id: 'alert-v16-created' } },
      { sourceIndex: 2, task: { outcome: 'not-selected' }, alert: { outcome: 'not-applicable' } },
      { sourceIndex: 3, task: { outcome: 'created', id: 'task-v16-removed' }, alert: { outcome: 'not-applicable' } },
      { sourceIndex: 4, task: { outcome: 'created', id: 'task-v16-modified' }, alert: { outcome: 'not-applicable' } },
    ],
  },
  {
    id: 'strategy-alice-v1', seriesId: 'series-alice', version: 1, userId: 'alice', status: 'superseded', importedAt: '2026-09-08T07:00:00.000Z',
    snapshot: { format: 'jj-strategy-v1', date: '2026-09-08', title: 'Alice 防守策略', tasks: [{ phase: 'live', title: '检查风险边界', detail: '只在边界内观察。', alert: null }] },
    links: [{ sourceIndex: 0, task: { outcome: 'created', id: 'task-alice' }, alert: { outcome: 'not-applicable' } }],
  },
];

const seed = {
  'jj-trading-v06-users': [{ id: 'user-jj', name: 'JJ', color: '#f2b84b' }, { id: 'alice', name: 'Alice', color: '#63b3ff' }],
  'jj-trading-v06-active-user': 'all',
  'jj-trading-v06-positions': [],
  'jj-trading-v06-watchlist': [
    { userId: 'user-jj', symbol: '600001', name: '测试标的', price: 10, changePct: 0, group: '测试', score: 50, state: '观察', note: '' },
    { userId: 'alice', symbol: '600001', name: '测试标的', price: 10, changePct: 0, group: '测试', score: 50, state: '观察', note: '' },
  ],
  'jj-trading-v07-workflows': [
    {
      id: 'user-jj-' + localDate, userId: 'user-jj', date: localDate, checks: {}, notes: {}, updatedAt: importedAt,
      customTasks: [
        { id: 'task-v16-created', phase: 'pre', title: jjTasks[0].title, detail: jjTasks[0].detail, sourceTitle: 'JJ 波段策略', strategyId: 'strategy-jj-v1', sourceTaskIndex: 0, importedAt },
        { id: 'task-v16-duplicate', phase: 'live', title: jjTasks[1].title, detail: jjTasks[1].detail, sourceTitle: '更早的同条件策略', importedAt: '2026-09-08T01:00:00.000Z' },
        { id: 'task-v16-modified', phase: 'live', title: jjTasks[4].title, detail: '用户后来修改过的判断。', sourceTitle: 'JJ 波段策略', strategyId: 'strategy-jj-v1', sourceTaskIndex: 4, importedAt },
        { id: 'task-legacy', phase: 'pre', title: '旧版来源任务', detail: '这条任务只有旧版来源名称。', sourceTitle: '旧版策略对话', importedAt: '2026-09-07T01:00:00.000Z' },
      ],
    },
    {
      id: 'alice-2026-09-08', userId: 'alice', date: '2026-09-08', checks: {}, notes: {}, updatedAt: '2026-09-08T07:00:00.000Z',
      customTasks: [{ id: 'task-alice', phase: 'live', title: '检查风险边界', detail: '只在边界内观察。', sourceTitle: 'Alice 防守策略', strategyId: 'strategy-alice-v1', sourceTaskIndex: 0, importedAt: '2026-09-08T07:00:00.000Z' }],
    },
  ],
  'jj-trading-v08-alerts': [
    { id: 'alert-v16-created', userId: 'user-jj', symbol: '600001', name: '测试标的', direction: 'below', target: 10, label: '观察主支撑：只观察明确价格边界，不自动执行。', sourceTitle: 'JJ 波段策略', strategyId: 'strategy-jj-v1', sourceTaskIndex: 1, enabled: true, acknowledged: false, createdAt: importedAt },
    { id: 'alert-legacy', userId: 'user-jj', symbol: '600001', name: '测试标的', direction: 'above', target: 12, label: '旧版提醒条件', sourceTitle: '旧版提醒策略', enabled: false, acknowledged: false, createdAt: '2026-09-07T01:00:00.000Z' },
  ],
  'jj-trading-v16-strategies': strategies,
  'jj-trading-v12-cash': { 'user-jj': 10000, alice: 10000 },
};

await context.addInitScript(data => {
  if (localStorage.getItem('strategy-center-seeded')) return;
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  localStorage.setItem('strategy-center-seeded', 'yes');
}, seed);

const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/push2delay.eastmoney.com/**', route => route.fulfill({ json: { data: { diff: [] } } }));

const selectUser = id => page.getByRole('combobox', { name: '账户视角' }).selectOption(id);
const openCenter = () => page.getByRole('button', { name: /^\u7b56\u7565\u4e2d\u5fc3/ }).click();
const archiveList = () => page.getByLabel('策略档案列表', { exact: true });
const recordCard = title => archiveList().getByRole('button').filter({ hasText: title });
const recordDetail = title => page.getByRole('article', { name: '策略详情 ' + title, exact: true });
const centerIsActive = () => page.getByRole('button', { name: /^\u7b56\u7565\u4e2d\u5fc3/ }).evaluate(element => element.classList.contains('active'));

try {
  await mkdir('test-results', { recursive: true });
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  await openCenter();

  assert.match(await page.locator('main').innerText(), /JJ \u6ce2\u6bb5\u7b56\u7565/);
  assert.match(await page.locator('main').innerText(), /Alice \u9632\u5b88\u7b56\u7565/);
  assert.match(await page.locator('main').innerText(), /\u65e7\u7248.*(?:\u6765\u6e90|\u8bb0\u5f55)/);

  await selectUser('user-jj');
  assert.equal(await archiveList().getByText('JJ 波段策略', { exact: true }).count(), 1);
  assert.equal(await archiveList().getByText('Alice 防守策略', { exact: true }).count(), 0);
  await selectUser('alice');
  assert.equal(await archiveList().getByText('Alice 防守策略', { exact: true }).count(), 1);
  assert.equal(await archiveList().getByText('JJ 波段策略', { exact: true }).count(), 0);
  await selectUser('all');

  const card = recordCard('JJ 波段策略');
  await card.click();
  const details = await recordDetail('JJ 波段策略').innerText();
  assert.match(details, /已导入/);
  assert.match(details, /\u6838\u5bf9\u6d77\u5916\u6620\u5c04/);
  assert.match(details, /任务 · 存在/);
  assert.match(details, /任务 · 重复/);
  assert.match(details, /任务 · 未选/);
  assert.match(details, /任务 · 已移除/);
  assert.match(details, /任务 · 已修改/);
  await page.screenshot({ path: 'test-results/v16-strategy-center-desktop.png', fullPage: true });

  await selectUser('user-jj');
  await page.getByRole('button', { name: /^\u4ea4\u6613\u65e5/ }).click();
  await page.locator('.phase-rail button').filter({ hasText: '盘前' }).click();
  assert.match(await page.locator('.workflow-checks').innerText(), /\u65e7\u7248\u6765\u6e90\u4efb\u52a1[\s\S]*\u6765\u81ea\uff1a\u65e7\u7248\u7b56\u7565\u5bf9\u8bdd/);
  await page.locator('.workflow-task-row').filter({ hasText: '核对海外映射' }).getByRole('button', { name: /^查看策略来源/ }).click();
  assert.equal(await centerIsActive(), true);
  assert.match(await recordDetail('JJ 波段策略').innerText(), /\u6838\u5bf9\u6d77\u5916\u6620\u5c04/);

  await page.getByTitle('\u6761\u4ef6\u63d0\u9192').click();
  assert.match(await page.locator('.alert-list').innerText(), /旧版 AI 来源 · 旧版提醒策略/);
  await page.locator('.alert-list article').filter({ hasText: '观察主支撑：只观察明确价格边界，不自动执行。' }).getByRole('button', { name: /^查看策略来源/ }).click();
  assert.equal(await centerIsActive(), true);
  assert.match(await recordDetail('JJ 波段策略').innerText(), /\u89c2\u5bdf\u4e3b\u652f\u6491/);

  await selectUser('all');
  await recordCard('Alice 防守策略').click();
  assert.equal(await recordDetail('Alice 防守策略').count(), 1);
  await recordCard('JJ 波段策略').click();
  assert.equal(await recordDetail('JJ 波段策略').count(), 1);
  await selectUser('user-jj');
  await page.reload();
  await page.waitForLoadState('networkidle');
  await openCenter();
  assert.equal(await archiveList().getByText('JJ 波段策略', { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jj-trading-v16-strategies')).length), 2);

  await page.setViewportSize({ width: 390, height: 844 });
  await recordCard('JJ 波段策略').click();
  await recordDetail('JJ 波段策略').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/v16-strategy-center-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS V1.6 strategy center filtering, detail states, legacy provenance, source navigation, persistence and mobile');
} finally {
  await browser.close();
}
