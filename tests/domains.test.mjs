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

import { reconcileQuotes, quoteIssues, canUseForRealtimeStrategy } from '../.test-build/domains/market/index.js';
const primarySource = { id: 'ifind', kind: 'REALTIME' };
const secondarySource = { id: 'choice', kind: 'REALTIME' };
const policy = { now: '2026-09-10T02:00:10Z', maxAgeMs: 30000, maxTimeDifferenceMs: 3000, maxFutureSkewMs: 1000, maxPriceDifferencePct: 0.05 };
const quoteFixture = (source = primarySource, changes = {}) => ({
  quote: { symbol: '688167', name: 'fixture', market: 'CN_A', last: 315, prevClose: 302.55,
    changePct: 4.12, open: null, high: null, low: null, volume: null, turnover: null,
    quoteTime: '2026-09-10T02:00:09Z', receivedAt: '2026-09-10T02:00:10Z',
    session: 'CONTINUOUS', source, ...changes }, raw: [],
});
const reconcile = (p, s, rules = policy) => reconcileQuotes('688167', primarySource, secondarySource, p, s, rules);
test('reconciliation covers six statuses without overwriting candidates', () => {
  const p = quoteFixture(), s = quoteFixture(secondarySource);
  const before = JSON.stringify([p, s]);
  assert.equal(reconcile(p, s).status, 'VERIFIED');
  assert.equal(reconcile(p, null).status, 'PRIMARY_ONLY');
  assert.equal(reconcile(null, s).status, 'SECONDARY_ONLY');
  assert.equal(reconcile(quoteFixture(primarySource, { quoteTime: '2026-09-10T01:00:00Z' }), null).status, 'STALE');
  assert.deepEqual(reconcile(p, quoteFixture(secondarySource, { last: 320 })).conflicts, ['last']);
  assert.equal(reconcile(p, quoteFixture(secondarySource, { last: 320 })).status, 'CONFLICT');
  assert.equal(reconcile(null, null).status, 'UNAVAILABLE');
  assert.equal(JSON.stringify([p, s]), before);
});
test('comparability precedes prices, duplicate sources never verify, invalid identity is rejected', () => {
  const p = quoteFixture();
  assert.equal(reconcile(p, quoteFixture(secondarySource, { last: 320, quoteTime: '2026-09-10T02:00:01Z' })).status, 'PRIMARY_ONLY');
  assert.equal(reconcile(p, quoteFixture(secondarySource, { market: 'US', last: 320 })).status, 'PRIMARY_ONLY');
  assert.equal(reconcile(p, quoteFixture(secondarySource, { session: 'CLOSED' })).status, 'PRIMARY_ONLY');
  assert.equal(reconcileQuotes('688167', primarySource, primarySource, p, p, policy).status, 'PRIMARY_ONLY');
  assert.equal(reconcile(quoteFixture(primarySource, { symbol: '000001' }), null).status, 'UNAVAILABLE');
  assert.equal(reconcile(quoteFixture(secondarySource), null).status, 'UNAVAILABLE');
  assert.deepEqual(reconcile(p, quoteFixture(secondarySource, { prevClose: 290 })).conflicts, ['prevClose']);
});
test('realtime admission rechecks time and requires explicit single-source opt-in', () => {
  const verified = reconcile(quoteFixture(), quoteFixture(secondarySource));
  assert.equal(canUseForRealtimeStrategy(verified, policy), true);
  assert.equal(canUseForRealtimeStrategy(verified, { ...policy, now: '2026-09-10T03:00:00Z' }), false);
  const single = reconcile(quoteFixture(), null);
  assert.equal(canUseForRealtimeStrategy(single, policy), false);
  assert.equal(canUseForRealtimeStrategy(single, policy, true), true);
  for (const status of ['STALE', 'CONFLICT', 'UNAVAILABLE']) {
    assert.equal(canUseForRealtimeStrategy({ ...verified, status }, policy, true), false);
  }
  assert.equal(reconcile(quoteFixture(primarySource, { quoteTime: '2026-09-10T03:00:00Z' }), null).status, 'STALE');
  assert.equal(reconcile(quoteFixture(primarySource, { receivedAt: '2026-09-10T03:00:00Z' }), null).status, 'STALE');
  assert.throws(() => reconcile(null, null, { ...policy, maxAgeMs: -1 }), /policy/);
});
test('normalized values reject nonfinite data, invalid ranges and ambiguous time zones', () => {
  for (const change of [{ last: NaN }, { prevClose: 0 }, { changePct: Infinity }, { high: 10, low: 20 }, { volume: -1 }, { quoteTime: '2026-09-10T10:00:00' }]) {
    assert.ok(quoteIssues(quoteFixture(primarySource, change).quote).length);
    assert.equal(reconcile(quoteFixture(primarySource, change), null).status, 'UNAVAILABLE');
  }
});
test('legacy malformed numeric or timestamp rows cannot poison valid display quotes', async () => {
  const rows = [item, ...[{ f3: NaN }, { f18: Infinity }, { f124: NaN }, { f124: 1e30 }].map(change => ({ ...item, ...change }))];
  const result = await new LegacyEastmoneyProvider(async () => ({ ok: true, json: async () => ({ data: { diff: rows } }) }), now).getQuotes(['688167']);
  assert.equal(toLegacyMarketQuotes(result).length, 1);
  assert.deepEqual(result.slice(1).map(q => q.status), Array(4).fill('UNAVAILABLE'));
});

import { reconcilePortfolio } from '../.test-build/domains/portfolio/index.js';
const accountSnapshotFixture = (changes = {}) => ({
  accountId: 'jj', asOf: '2026-09-10', currency: 'CNY', cash: 10000,
  positions: [{ symbol: '688167', quantity: 1800 }], positionsComplete: true, ...changes,
});
test('portfolio reconciliation matches explicit evidence and copies snapshots without posting', () => {
  const a = accountSnapshotFixture(), b = accountSnapshotFixture();
  const before = JSON.stringify([a, b]);
  const result = reconcilePortfolio('r', 'broker-statement-1', a, b);
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.evidenceRef, 'broker-statement-1');
  assert.deepEqual(result.differences, []);
  assert.equal(JSON.stringify([a, b]), before);
  assert.notEqual(result.recordedSnapshot, a);
  assert.notEqual(result.recordedSnapshot.positions[0], a.positions[0]);
  a.positions[0].quantity = 2200;
  assert.equal(result.recordedSnapshot.positions[0].quantity, 1800);
});
test('portfolio reconciliation detects cash and share differences deterministically', () => {
  const result = reconcilePortfolio('r', 'evidence', accountSnapshotFixture(),
    accountSnapshotFixture({ cash: 12000, positions: [{ symbol: '688167', quantity: 2200 }] }));
  assert.equal(result.status, 'MISMATCH');
  assert.deepEqual(result.differences, [
    { field: 'cash', recorded: 10000, observed: 12000 },
    { field: 'quantity:688167', recorded: 1800, observed: 2200 },
  ]);
  assert.equal(reconcilePortfolio('r', 'e', accountSnapshotFixture(), accountSnapshotFixture({ cash: 10000.01 })).status, 'MATCHED');
  assert.equal(reconcilePortfolio('r', 'e', accountSnapshotFixture(), accountSnapshotFixture({ cash: 10000.02 })).status, 'MISMATCH');
});
test('missing holdings require complete statements and unknown values stay pending', () => {
  const a = accountSnapshotFixture();
  assert.equal(reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ positions: [] })).status, 'MISMATCH');
  const partial = reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ positions: [], positionsComplete: false }));
  assert.equal(partial.status, 'PENDING');
  assert.equal(partial.differences[0].observed, null);
  assert.equal(reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ cash: null })).status, 'PENDING');
  assert.equal(reconcilePortfolio('r', 'e', accountSnapshotFixture({ cash: null }), accountSnapshotFixture({ cash: null })).status, 'PENDING');
  assert.equal(reconcilePortfolio('r', 'e', accountSnapshotFixture({ positionsComplete: false }), a).status, 'PENDING');
  assert.equal(reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ cash: null, positions: [] })).status, 'MISMATCH');
});
test('portfolio reconciliation refuses mixed accounts/currencies and never compares different dates', () => {
  const a = accountSnapshotFixture();
  assert.throws(() => reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ accountId: 'other' })), /accounts/);
  assert.throws(() => reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ currency: 'USD' })), /currencies/);
  const result = reconcilePortfolio('r', 'e', a, accountSnapshotFixture({ asOf: '2026-09-09', cash: 0 }));
  assert.equal(result.status, 'PENDING');
  assert.deepEqual(result.differences, []);
  assert.deepEqual(result.issues, ['valuationDateMismatch']);
});
test('portfolio reconciliation validates evidence, duplicate holdings, dates and finite values', () => {
  const a = accountSnapshotFixture();
  assert.throws(() => reconcilePortfolio('r', '', a, a), /evidence/);
  assert.throws(() => reconcilePortfolio('r', 'e', a, a, -1), /tolerance/);
  for (const changes of [
    { cash: NaN }, { asOf: '2026-02-30' }, { positionsComplete: undefined },
    { positions: [{ symbol: '688167', quantity: -1 }] },
    { positions: [{ symbol: '688167', quantity: Infinity }] },
    { positions: [{ symbol: '688167', quantity: 1 }, { symbol: '688167', quantity: 2 }] },
  ]) assert.throws(() => reconcilePortfolio('r', 'e', a, accountSnapshotFixture(changes)));
});

import { evaluateStrategy } from '../.test-build/domains/strategy/index.js';
const strategyFixture = () => ({
  id: 'v1', seriesId: 'jg', version: 1, previousVersionId: null, accountId: 'jj',
  symbol: '688167', createdAt: '2026-09-10', sourceRef: 'fixture', initialStateId: 'DEFENSIVE',
  states: ['DEFENSIVE', 'REPAIR', 'STRONG'].map(id => ({ id, label: id,
    zone: { id: id + '-zone', kind: 'PRICE_ZONE', lower: 300, upper: 320 }, invalidations: [] })),
  transitions: [{ id: 'repair', from: 'DEFENSIVE', to: 'REPAIR',
    trigger: { id: 'reclaim', kind: 'PRICE_ZONE', lower: 307, upper: 310 },
    invalidations: [], action: { kind: 'OBSERVE', rationale: '复核', requiresManualConfirmation: true } }],
});
const assess = (s, price = 308, changes = {}) => {
  const market = reconcile(quoteFixture(primarySource, { last: price }), quoteFixture(secondarySource, { last: price }));
  return evaluateStrategy(s, 'jj', 'DEFENSIVE', { ...market, ...changes }, policy);
};
test('strategy evaluation produces one-hop candidates without changing state or inputs', () => {
  const s = strategyFixture(), before = JSON.stringify(s);
  const result = assess(s);
  assert.equal(result.status, 'EVALUATED');
  assert.equal(result.currentStateId, 'DEFENSIVE');
  assert.equal(result.transitions[0].status, 'CANDIDATE');
  assert.equal(result.transitions[0].suggestion.requiresManualConfirmation, true);
  assert.equal(JSON.stringify(s), before);
  assert.notEqual(result.transitions[0].suggestion, s.transitions[0].action);
  s.transitions.push({ ...s.transitions[0], id: 'next', from: 'REPAIR', to: 'STRONG' });
  assert.equal(assess(s).transitions.length, 1);
});
test('price zones are inclusive and above/below are strict comparisons, not crossing events', () => {
  const s = strategyFixture();
  for (const price of [307, 310]) assert.equal(assess(s, price).transitions[0].status, 'CANDIDATE');
  assert.equal(assess(s, 306).transitions[0].status, 'NOT_TRIGGERED');
  s.transitions[0].trigger = { id: 'above', kind: 'ABOVE', lower: 310, upper: 310 };
  assert.equal(assess(s, 310).transitions[0].status, 'NOT_TRIGGERED');
  assert.equal(assess(s, 311).transitions[0].status, 'CANDIDATE');
  s.transitions[0].trigger.kind = 'BELOW';
  assert.equal(assess(s, 310).transitions[0].status, 'NOT_TRIGGERED');
  assert.equal(assess(s, 309).transitions[0].status, 'CANDIDATE');
});
test('duration and composite evidence remain pending; invalidation takes precedence', () => {
  const s = strategyFixture();
  s.transitions[0].trigger.holdSeconds = 300;
  assert.equal(assess(s).transitions[0].status, 'PENDING');
  assert.equal(assess(s).transitions[0].suggestion, null);
  delete s.transitions[0].trigger.holdSeconds;
  s.transitions[0].trigger.confirmation = '至少两只同行走强';
  assert.equal(assess(s).transitions[0].status, 'PENDING');
  delete s.transitions[0].trigger.confirmation;
  s.states[0].invalidations.push({ trigger: { id: 'risk', kind: 'BELOW', lower: 309, upper: 309 }, reason: '防守失效' });
  assert.equal(assess(s).transitions[0].status, 'INVALIDATED');
  s.states[0].invalidations[0].trigger.holdSeconds = 60;
  assert.equal(assess(s).transitions[0].status, 'PENDING');
});
test('strategy rejects unusable market data, account/symbol mismatches and malformed plans', () => {
  const s = strategyFixture();
  for (const status of ['STALE', 'CONFLICT', 'UNAVAILABLE', 'PRIMARY_ONLY']) {
    assert.equal(assess(s, 308, { status }).status, 'BLOCKED');
  }
  s.accountId = 'other';
  assert.ok(assess(s).reasons.includes('accountMismatch'));
  s.accountId = 'jj'; s.symbol = '000001';
  assert.ok(assess(s).reasons.includes('symbolMismatch'));
  s.symbol = '688167'; s.transitions[0].to = 'missing';
  assert.equal(assess(s).status, 'BLOCKED');
});
test('multiple eligible transitions remain separate candidates without automatic priority', () => {
  const s = strategyFixture();
  s.transitions.push({ ...s.transitions[0], id: 'alternative', to: 'STRONG' });
  assert.deepEqual(assess(s).transitions.map(t => t.status), ['CANDIDATE', 'CANDIDATE']);
});
