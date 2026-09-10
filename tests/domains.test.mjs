import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteValidationStatus, LegacyEastmoneyProvider, toLegacyMarketQuotes } from '../.test-build/domains/market/index.js';
import { fromLegacyTrade, fromLegacyPosition, fromLegacyAccount, validateTradeLedgerEntry, validateCashLedgerEntry } from '../.test-build/domains/portfolio/index.js';
import { validateStrategyVersion } from '../.test-build/domains/strategy/index.js';

const item = { f2: 31500, f3: 412, f12: '688167', f14: '炬光科技', f18: 30255, f124: 1789023600 };
const now = () => new Date('2026-09-10T08:00:00Z');
test('market states and delayed normalization preserve V1 price units and evidence', async () => {
  assert.deepEqual(Object.values(QuoteValidationStatus), ['VERIFIED', 'PRIMARY_ONLY', 'SECONDARY_ONLY', 'STALE', 'CONFLICT', 'UNAVAILABLE']);
  let calls = 0;
  const provider = new LegacyEastmoneyProvider(async (url, options) => {
    calls++;
    assert.equal(new URL(url).searchParams.get('secids'), '1.688167,0.000001');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ data: { diff: [item, { ...item, f2: '-' }] } }) };
  }, now);
  const result = await provider.getQuotes(['688167', '688167', 'invalid', '000001']);
  assert.equal(calls, 1);
  assert.equal(result[0].status, 'STALE');
  assert.equal(result[0].quote.session, 'UNKNOWN');
  assert.equal(result[0].quote.open, null);
  assert.equal(result[0].primarySource.kind, 'DELAYED');
  assert.equal(result[0].confidence, null);
  assert.equal(result[0].secondarySource, null);
  assert.equal(result[1].status, 'UNAVAILABLE');
  assert.equal(result[1].quote, null);
  assert.equal(result[0].raw[0].rawPayload.f2, 31500);
  assert.ok(Object.isFrozen(result[0].raw[0].rawPayload));
  assert.deepEqual(toLegacyMarketQuotes(result), [{
    symbol: '688167', name: '炬光科技', price: 315, changePct: 4.12,
    previousClose: 302.55, updatedAt: new Date(item.f124 * 1000).toISOString(),
  }]);
  assert.deepEqual(await provider.getQuotes(['bad']), []);
  assert.equal(calls, 1);
});
test('legacy provider preserves empty results and propagates failures', async () => {
  assert.deepEqual(await new LegacyEastmoneyProvider(async () => ({ ok: true, json: async () => ({}) })).getQuotes(['688167']), []);
  await assert.rejects(new LegacyEastmoneyProvider(async () => ({ ok: false, status: 503 })).getQuotes(['688167']), /503/);
  await assert.rejects(new LegacyEastmoneyProvider(async () => { throw new Error('network'); }).getQuotes(['688167']), /network/);
  await assert.rejects(new LegacyEastmoneyProvider(async () => ({ ok: true, json: async () => { throw new Error('json'); } })).getQuotes(['688167']), /json/);
});
test('portfolio compatibility preserves unknown ownership, fees and snapshot without posting trades', () => {
  const trade = Object.freeze({ id: 't', date: '2026-09-09', side: '卖出', symbol: '688167', name: '炬光', shares: 400, price: 316.045 });
  const position = Object.freeze({ id: 'p', symbol: '688167', name: '炬光', shares: 1800, cost: 200, price: 315, reportedMarketValue: 567000 });
  const entry = fromLegacyTrade(trade);
  assert.equal(entry.accountId, null);
  assert.equal(entry.fee, null);
  assert.equal(entry.postingStatus, 'RECORD_ONLY');
  assert.deepEqual(validateTradeLedgerEntry(entry), []);
  const snapshot = fromLegacyPosition(position, '2026-09-09');
  assert.deepEqual(snapshot.position, position);
  assert.notEqual(snapshot.position, position);
  assert.equal(position.shares, 1800);
  assert.equal(fromLegacyAccount({ id: 'jj', name: 'JJ', color: 'red' }, undefined).availableCash, null);
  assert.equal(fromLegacyAccount({ id: 'jj', name: 'JJ', color: 'red' }, 0).availableCash, 0);
  for (const change of [{ quantity: -1 }, { quantity: 1.5 }, { price: NaN }, { fee: -1 }, { occurredAt: 'bad' }, { side: 'OTHER' }, { postingStatus: 'POSTED' }]) {
    assert.ok(validateTradeLedgerEntry({ ...entry, ...change }).length);
  }
  const cash = { id: 'c', accountId: 'jj', occurredAt: '2026-09-09', currency: 'CNY', amount: -100, kind: 'WITHDRAWAL', source: 'manual' };
  assert.deepEqual(validateCashLedgerEntry(cash), []);
  for (const change of [{ amount: 100 }, { amount: NaN }, { accountId: '' }, { currency: 'bad' }, { kind: 'bad' }]) {
    assert.ok(validateCashLedgerEntry({ ...cash, ...change }).length);
  }
});
test('strategy represents price zones, invalidation and referenced transitions without execution', () => {
  const zone = (id, lower, upper = lower) => ({ id, kind: 'PRICE_ZONE', lower, upper });
  const states = [
    ['DEFENSIVE', 300, 303], ['REPAIR', 307, 310], ['STRONG', 314, 316],
    ['BREAKOUT', 318, 320], ['NEXT_SUPPORT', 293, 293],
  ].map(([id, lower, upper]) => ({ id, label: id, zone: zone(id, lower, upper), invalidations: [] }));
  const invalidation = { trigger: { ...zone('lose293', 293), kind: 'BELOW' }, reason: '失守293' };
  const strategy = {
    id: 'v2', seriesId: 'jg', version: 2, previousVersionId: 'v1', accountId: 'jj',
    symbol: '688167', createdAt: '2026-09-10', sourceRef: 'reviewed-plan',
    initialStateId: 'DEFENSIVE', states,
    transitions: [{ id: 'repair', from: 'DEFENSIVE', to: 'REPAIR',
      trigger: { ...zone('reclaim', 307, 310), holdSeconds: 300, confirmation: '至少2只核心股转强' },
      invalidations: [invalidation], action: { kind: 'OBSERVE', rationale: '等待复核', requiresManualConfirmation: true } }],
  };
  assert.deepEqual(validateStrategyVersion(strategy), []);
  assert.ok(validateStrategyVersion({ ...strategy, states: [...states, states[0]] }).includes('states'));
  assert.ok(validateStrategyVersion({ ...strategy, transitions: [{ ...strategy.transitions[0], to: 'missing' }] }).includes('transitionReference'));
  assert.ok(validateStrategyVersion({ ...strategy, transitions: [{ ...strategy.transitions[0], trigger: zone('bad', 310, 307) }] }).includes('trigger'));
  assert.ok(validateStrategyVersion({ ...strategy, version: 0 }).includes('metadata'));
});
