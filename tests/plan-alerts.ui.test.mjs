import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:5174/jj-trading-hub/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const plan = { id: 'plan-jj', userId: 'user-jj', symbol: '600001', name: '测试计划', entry: 10, stop: 9, target: 12, shares: 100, riskAmount: 100, capital: 1000, rewardRiskRatio: 2, createdAt: '2026-09-08T00:00:00Z' };
const watch = { symbol: '600001', name: '测试计划', price: 10, changePct: 0, group: '测试', score: 50, state: '观察', note: '' };
const manual = { id: 'manual', userId: 'user-jj', symbol: '600001', name: '测试计划', direction: 'above', target: 20, label: '手动提醒', enabled: true, acknowledged: false, createdAt: plan.createdAt };
await context.addInitScript(({ plan, watch, manual }) => {
  if (localStorage.getItem('seeded')) return;
  const seed = {
    'jj-trading-v06-users': [{ id: 'user-jj', name: 'JJ', color: '#fff' }, { id: 'alice', name: 'Alice', color: '#aaa' }],
    'jj-trading-v06-active-user': 'user-jj', 'jj-trading-v06-positions': [],
    'jj-trading-v06-watchlist': ['user-jj', 'alice'].map(userId => ({ ...watch, userId })),
    'jj-trading-v10-risk-plans': [plan, { ...plan, id: 'plan-alice', userId: 'alice' }],
    'jj-trading-v08-alerts': [manual], 'jj-trading-v12-cash': { 'user-jj': 10000, alice: 10000 },
  };
  Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  localStorage.setItem('seeded', 'yes');
}, { plan, watch, manual });
const page = await context.newPage(); const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await page.route('**/push2delay.eastmoney.com/**', route => route.fulfill({ json: { data: { diff: [] } } }));
const alerts = () => page.evaluate(() => JSON.parse(localStorage.getItem('jj-trading-v08-alerts')));
const risk = () => page.getByRole('button', { name: /^风控/ }).click();
const setup = () => page.getByRole('button', { name: '设置计划提醒', exact: true }).click();
const confirm = () => page.getByRole('button', { name: '确认生成缺失提醒', exact: true }).click();
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(baseUrl); await page.waitForLoadState('networkidle');
  await risk(); console.log('Risk DOM:', (await page.locator('.risk-plans').innerText()).slice(0, 1000));
  await setup(); await page.getByLabel('入场提醒方向').selectOption('below');
  assert.match(await page.locator('.plan-level-preview').innerText(), /入场 · ≤ 10.00/);
  await confirm(); assert.equal((await alerts()).length, 4);
  await page.getByRole('button', { name: '查看提醒中心' }).click();
  const target = page.locator('.alert-list article').filter({ hasText: '计划关联 · 目标' });
  await target.getByTitle('删除提醒', { exact: true }).click();
  assert.equal((await alerts()).length, 3);
  await page.getByRole('button', { name: '关闭提醒中心' }).click();
  await setup(); await confirm(); assert.equal((await alerts()).length, 4);
  await page.getByRole('button', { name: '查看提醒中心' }).click();
  const entry = page.locator('.alert-list article').filter({ hasText: '计划关联 · 入场' });
  await entry.getByTitle('暂停提醒', { exact: true }).click();
  await page.getByRole('button', { name: '关闭提醒中心' }).click();
  await setup(); await confirm();
  assert.equal((await alerts()).length, 4);
  assert.equal((await alerts()).find(a => a.planLevel === 'entry').enabled, false);
  await page.getByRole('combobox', { name: '账户视角' }).selectOption('alice');
  await setup(); await confirm(); assert.equal((await alerts()).length, 7);
  await page.getByRole('button', { name: '查看提醒中心' }).click();
  assert.equal(await page.locator('.alert-list article').count(), 3);
  await page.getByRole('button', { name: '关闭提醒中心' }).click();
  await page.getByRole('combobox', { name: '账户视角' }).selectOption('user-jj');
  await page.reload(); await page.waitForLoadState('networkidle'); await risk();
  assert.match(await page.locator('.plan-link-actions').innerText(), /3\/3 条关联 · 2 条启用/);
  await page.screenshot({ path: 'test-results/v13-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await setup();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'test-results/v13-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByTitle('删除 测试计划 计划', { exact: true }).click();
  assert.equal((await alerts()).length, 4);
  assert.equal((await alerts()).filter(a => a.userId === 'alice').length, 3);
  assert.deepEqual((await alerts()).find(a => a.id === 'manual'), manual);
  // Removing a watched symbol must not silently create unmonitored plan rules.
  await page.evaluate(() => localStorage.setItem('jj-trading-v06-watchlist', '[]'));
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.getByRole('combobox', { name: '账户视角' }).selectOption('alice'); await risk();
  await setup(); await confirm();
  assert.match(await page.getByRole('alert').innerText(), /观察池/);
  assert.equal((await alerts()).length, 4);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '查看提醒中心' }).click();
  assert.match(await page.locator('.alert-list').innerText(), /缺少观察池标的/);
  assert.deepEqual(errors, []);
  console.log('PASS V1.3 preview, pause-preserving dedupe, account isolation, persistence, mobile and linked cleanup');
} finally { await browser.close(); }
