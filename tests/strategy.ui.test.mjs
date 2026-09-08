import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  if (localStorage.getItem('seeded')) return;
  const watch = { symbol: '600001', name: '测试标的', price: 10, changePct: 0, group: '测试', score: 50, state: '观察', note: '' };
  const data = {
    'jj-trading-v06-users': [{ id: 'user-jj', name: 'JJ', color: '#fff' }, { id: 'alice', name: 'Alice', color: '#aaa' }],
    'jj-trading-v06-active-user': 'all', 'jj-trading-v06-positions': [],
    'jj-trading-v06-watchlist': ['user-jj', 'alice'].map(userId => ({ ...watch, userId })),
    'jj-trading-v08-alerts': [], 'jj-trading-v07-workflows': [],
  };
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  localStorage.setItem('seeded', 'yes');
});
const page = await context.newPage(); const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/push2delay.eastmoney.com/**', route => route.fulfill({ json: { data: { diff: [] } } }));
const state = () => page.evaluate(() => ({ workflows: JSON.parse(localStorage.getItem('jj-trading-v07-workflows')), alerts: JSON.parse(localStorage.getItem('jj-trading-v08-alerts')) }));
const open = async () => { await page.getByRole('button', { name: /^交易日/ }).click(); await page.getByRole('button', { name: 'AI 策略快导', exact: true }).click(); };
const check = () => page.getByRole('checkbox', { name: /^我已核对/ }).check();
const submit = () => page.getByRole('button', { name: '确认导入策略', exact: true }).click();
try {
  await mkdir('test-results', { recursive: true });
  await page.goto('http://127.0.0.1:5174/jj-trading-hub/'); await page.waitForLoadState('networkidle');
  const date = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  const pack = { format: 'jj-strategy-v1', date, title: '测试策略包', tasks: [
    { phase: 'pre', title: '确认策略条件', detail: '未确认的信息仍待确认。', alert: null },
    { phase: 'live', title: '观察测试价格', detail: '仅观察价格边界，执行前核对实际持仓。', alert: { symbol: '600001', name: '测试标的', direction: 'above', target: 12 } },
    { phase: 'close', title: '记录待补标的', detail: '观察池外的标的先保留为任务。', alert: { symbol: '600002', name: '未知标的', direction: 'below', target: 9 } },
  ] };
  const raw = JSON.stringify(pack);
  await open();
  console.log('Importer DOM:', (await page.getByRole('dialog').innerText()).slice(0, 1000));
  await page.getByLabel('策略 JSON', { exact: true }).fill(raw);
  assert.match(await page.getByRole('alert').innerText(), /具体账户/);
  await page.getByLabel('导入账户', { exact: true }).selectOption('user-jj');
  assert.equal(await page.getByLabel('启用价格提醒 2', { exact: true }).isChecked(), false);
  assert.equal(await page.getByLabel('启用价格提醒 3', { exact: true }).isDisabled(), true);
  await page.screenshot({ path: 'test-results/v14-desktop.png', fullPage: true });
  await check(); await submit();
  assert.equal((await state()).workflows[0].customTasks.length, 3); assert.equal((await state()).alerts.length, 0);
  await open(); await page.getByLabel('策略 JSON', { exact: true }).fill(raw);
  await page.getByLabel('启用价格提醒 2', { exact: true }).check();
  await check(); await submit();
  assert.equal((await state()).workflows[0].customTasks.length, 3); assert.equal((await state()).alerts.length, 1);
  await page.getByRole('button', { name: '查看提醒中心', exact: true }).click();
  assert.match(await page.locator('.alert-list').innerText(), /AI 策略 · 测试策略包/);
  await page.getByTitle('暂停提醒', { exact: true }).click(); await page.getByRole('button', { name: '关闭提醒中心' }).click();
  await open(); await page.getByLabel('策略 JSON', { exact: true }).fill(raw);
  await page.getByLabel('启用价格提醒 2', { exact: true }).check(); await check();
  assert.equal(await page.getByRole('button', { name: '确认导入策略', exact: true }).isDisabled(), true);
  assert.equal((await state()).alerts[0].enabled, false);
  await page.getByLabel('导入账户', { exact: true }).selectOption('alice');
  assert.equal(await page.getByLabel('启用价格提醒 2', { exact: true }).isChecked(), false);
  assert.equal(await page.getByRole('checkbox', { name: /^我已核对/ }).isChecked(), false);
  await page.getByLabel('启用价格提醒 2', { exact: true }).check(); await check(); await submit();
  assert.equal((await state()).workflows.length, 2); assert.equal((await state()).alerts.length, 2);
  await page.reload(); await page.waitForLoadState('networkidle');
  assert.equal((await state()).alerts.length, 2);
  await open(); const before = await state();
  await page.getByLabel('策略 JSON', { exact: true }).fill(JSON.stringify({ ...pack, date: '2000-01-01' }));
  assert.match(await page.getByRole('alert').innerText(), /只允许导入今天/);
  await page.getByLabel('策略 JSON', { exact: true }).fill('{bad json');
  assert.match(await page.getByRole('alert').innerText(), /有效的策略 JSON/);
  await page.getByLabel('策略 JSON', { exact: true }).fill(raw);
  await page.getByRole('button', { name: '取消', exact: true }).click(); assert.deepEqual(await state(), before);
  await open();
  const nextPack = { ...pack, tasks: [{ ...pack.tasks[1], title: '新的条件任务', alert: { ...pack.tasks[1].alert, target: 13 } }] };
  await page.getByLabel('策略 JSON', { exact: true }).fill(JSON.stringify(nextPack));
  await page.getByLabel('启用价格提醒 1', { exact: true }).check(); await check();
  await page.evaluate(() => { const original = Storage.prototype.setItem; let fail = true; Storage.prototype.setItem = function(key, value) { if (key === 'jj-trading-v08-alerts' && fail) { fail = false; throw new DOMException('quota', 'QuotaExceededError'); } return original.call(this, key, value); }; });
  await submit(); assert.match(await page.getByRole('alert').innerText(), /已回退/); assert.deepEqual(await state(), before);
  assert.match(await page.getByLabel('策略 JSON', { exact: true }).inputValue(), /新的条件任务/);
  await page.setViewportSize({ width: 390, height: 844 });
  await check(); await page.getByRole('button', { name: '确认导入策略', exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/v14-mobile.png' });
  await submit();
  assert.equal((await state()).alerts.length, 3);
  assert.deepEqual(errors, []);
  console.log('PASS V1.4 explicit account and alert opt-in, dedupe, sources, isolation, date/JSON rejection, cancel, rollback/retry and mobile');
} finally { await browser.close(); }
