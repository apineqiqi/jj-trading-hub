import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [];
const seed = {
  'jj-trading-v06-users': [{ id: 'user-jj', name: 'JJ', color: '#f2b84b' }, { id: 'alice', name: 'Alice', color: '#63b3ff' }],
  'jj-trading-v06-active-user': 'all',
  'jj-trading-v06-positions': [{ id: 'p1', userId: 'user-jj', symbol: '600001', name: '测试一', shares: 100, cost: 8, price: 10 }, { id: 'p2', userId: 'alice', symbol: '600002', name: '测试二', shares: 100, cost: 18, price: 20 }],
  'jj-trading-v06-watchlist': [],
  'jj-trading-v04-snapshots': [undefined, 'user-jj', 'alice'].map((userId, index) => ({ id: 's' + index, ...(userId ? { userId } : {}), date: '2026-09-0' + (index + 1), totalAssets: 1000 + index, marketValue: 500, cash: 500 + index, unrealizedPnl: 0 })),
  'jj-trading-v04-trades': [undefined, 'user-jj', 'alice'].map((userId, index) => ({ id: 't' + index, ...(userId ? { userId } : {}), date: '2026-09-03', side: '买入', symbol: '600001', name: '交易' + index, shares: 100, price: 10, fee: 1 })),
  'jj-trading-v12-cash': { 'user-jj': 10000, alice: 0 },
  'jj-trading-v10-risk-profiles': [{ userId: 'user-jj', singlePositionPct: 35, portfolioPct: 65, tradeRiskPct: 1, dailyLossPct: 2 }],
};
await context.addInitScript(data => { if (!localStorage.getItem('test-seeded')) { Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value))); localStorage.setItem('test-seeded', 'yes'); } }, seed);
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.route('**/push2delay.eastmoney.com/**', route => route.fulfill({ json: { data: { diff: [] } } }));
const readState = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('jj-trading-')).map(key => [key, JSON.parse(localStorage.getItem(key))])));
const openData = () => page.getByRole('button', { name: '资金与备份', exact: true }).click();
const selectUser = id => page.getByRole('combobox', { name: '账户视角' }).selectOption(id);
try {
  await mkdir('test-results', { recursive: true });
  await page.goto('http://127.0.0.1:5174/jj-trading-hub/');
  await page.waitForLoadState('networkidle');
  assert.match(await page.locator('body').innerText(), /V1.2/);
  await openData();
  await page.getByLabel('Alice可用现金').fill('2000');
  await page.getByRole('button', { name: '保存账户现金' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await selectUser('alice');
  assert.match(await page.locator('.stats').innerText(), /4,000.00/);
  await page.getByRole('button', { name: /^复盘/ }).click();
  console.log('Review DOM:', (await page.locator('main').innerText()).slice(0, 900));
  assert.equal(await page.locator('.snapshot-row').count(), 1);
  assert.equal(await page.locator('.trade-row').count(), 1);
  await page.locator('.legacy-records select').first().selectOption('alice');
  assert.equal(await page.locator('.snapshot-row').count(), 2);
  await selectUser('user-jj');
  assert.equal(await page.locator('.snapshot-row').count(), 1);
  assert.equal(await page.locator('.trade-row').count(), 1);
  console.log('PASS account cash and legacy ownership isolation');

  await page.getByRole('button', { name: /^交易日/ }).click();
  assert.match(await page.locator('.risk-line').innerText(), /65%/);
  const text = '## 盘前\n1. 检查隔夜风险：保留完整条件\n## 盘中\n2. 观察量价变化\n## 收盘\n3. 记录执行偏差';
  await page.getByRole('button', { name: '从 ChatGPT 导入' }).click();
  await page.getByLabel('对话内容', { exact: true }).fill(text);
  assert.equal(await page.getByLabel('任务 1 阶段').inputValue(), 'pre');
  assert.equal(await page.getByLabel('任务 2 阶段').inputValue(), 'live');
  assert.equal(await page.getByLabel('任务 3 阶段').inputValue(), 'close');
  await page.screenshot({ path: 'test-results/desktop-import.png' });
  await page.getByRole('button', { name: '导入 3 项任务', exact: true }).click();
  await page.getByRole('button', { name: '从 ChatGPT 导入' }).click();
  await page.getByLabel('对话内容', { exact: true }).fill(text);
  assert.equal(await page.getByRole('button', { name: '导入 0 项任务', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  for (let index = 0; index < 4; index++) await page.locator('.workflow-task-row > button').nth(index).click();
  assert.equal(await page.locator('.phase-rail button').first().evaluate(el => el.classList.contains('complete')), false);
  await page.locator('.workflow-task-row > button').nth(4).click();
  assert.equal(await page.locator('.phase-rail button').first().evaluate(el => el.classList.contains('complete')), true);
  await page.getByRole('button', { name: '编辑任务', exact: true }).click();
  await page.getByLabel('任务标题', { exact: true }).fill('确认隔夜风险与现金');
  await page.getByLabel('所属阶段').selectOption('close');
  await page.getByRole('button', { name: '保存任务', exact: true }).click();
  assert.match(await page.locator('.workflow-checks').innerText(), /确认隔夜风险与现金/);
  await page.reload(); await page.waitForLoadState('networkidle');
  let state = await readState();
  const workflow = state['jj-trading-v07-workflows'][0];
  assert.equal(workflow.customTasks.length, 3);
  const edited = workflow.customTasks.find(task => task.title === '确认隔夜风险与现金');
  assert.equal(edited.phase, 'close'); assert.equal(workflow.checks[edited.id], true);
  console.log('PASS multi-phase import, duplicate prevention, edit and progress persistence');

  await openData();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  const download = await downloading; await download.saveAs('test-results/backup.json');
  const exported = JSON.parse(await readFile('test-results/backup.json', 'utf8'));
  assert.deepEqual(exported.data, state);
  await page.getByLabel('选择恢复文件', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"jj-trading-hub"}') });
  assert.match(await page.getByRole('alert').innerText(), /完整备份/);
  assert.deepEqual(await readState(), state);
  await page.getByLabel('Alice可用现金').fill('3333');
  await page.getByRole('button', { name: '保存账户现金' }).click();
  await page.getByLabel('选择恢复文件', { exact: true }).setInputFiles('test-results/backup.json');
  await page.getByRole('button', { name: '替换本机数据并恢复', exact: true }).click();
  await page.waitForLoadState('networkidle');
  assert.deepEqual(await readState(), state);
  console.log('PASS backup download, invalid-file rejection and complete restore roundtrip');

  await page.evaluate(() => { Storage.prototype.setItem = function() { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await openData(); await page.getByLabel('JJ可用现金').fill('12345');
  await page.getByRole('button', { name: '保存账户现金' }).click();
  assert.match(await page.locator('.save-state').innerText(), /保存失败/);
  const failedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份', exact: true }).click();
  await (await failedDownload).saveAs('test-results/unsaved-backup.json');
  assert.equal(JSON.parse(await readFile('test-results/unsaved-backup.json', 'utf8')).data['jj-trading-v12-cash']['user-jj'], 12345);
  console.log('PASS failed-save warning and export of unsaved changes');
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^交易日/ }).click();
  await page.getByRole('button', { name: '从 ChatGPT 导入' }).click();
  await page.getByLabel('对话内容', { exact: true }).fill(text);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole('button', { name: '导入 1 项任务', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/mobile-import.png' });
  await page.getByRole('button', { name: '导入 1 项任务', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS mobile layout; no browser runtime errors');
} finally { await browser.close(); }
