import type { PortfolioAccount, ReconciliationRecord } from './index.js';

export interface ReconciliationSnapshot {
  readonly accountId: string;
  // Explicit valuation date; this module does not infer a date from trade logs.
  readonly asOf: string;
  readonly currency: PortfolioAccount['currency'];
  readonly cash: number | null;
  readonly positions: readonly { readonly symbol: string; readonly quantity: number | null }[];
  // Only a complete statement can establish that an omitted holding is zero.
  readonly positionsComplete: boolean;
}
export interface ReconciliationResult extends ReconciliationRecord {
  readonly issues: readonly string[];
  readonly recordedSnapshot: ReconciliationSnapshot;
  readonly observedSnapshot: ReconciliationSnapshot;
}

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(day + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
function validateSnapshot(snapshot: ReconciliationSnapshot): void {
  if (!snapshot.accountId.trim() || !validDay(snapshot.asOf) ||
    !['CNY', 'USD'].includes(snapshot.currency) || typeof snapshot.positionsComplete !== 'boolean') {
    throw new Error('Invalid snapshot metadata');
  }
  if (snapshot.cash !== null && !Number.isFinite(snapshot.cash)) throw new Error('Invalid cash');
  const symbols = new Set<string>();
  for (const position of snapshot.positions) {
    if (!position.symbol.trim() || position.symbol !== position.symbol.trim() || symbols.has(position.symbol)) {
      throw new Error('Empty or duplicate position symbol');
    }
    symbols.add(position.symbol);
    // No A-share lot-size assumption; fractional holdings may exist in other markets.
    if (position.quantity !== null && (!Number.isFinite(position.quantity) || position.quantity < 0)) {
      throw new Error('Invalid position quantity');
    }
  }
}
const copy = (snapshot: ReconciliationSnapshot): ReconciliationSnapshot => ({
  ...snapshot, positions: snapshot.positions.map(position => ({ ...position })),
});

/** Read-only comparison. Never posts trades, updates cash, or repairs holdings. */
export function reconcilePortfolio(
  id: string,
  evidenceRef: string,
  recorded: ReconciliationSnapshot,
  observed: ReconciliationSnapshot,
  cashTolerance = 0.01,
): ReconciliationResult {
  if (!id.trim() || !evidenceRef.trim()) throw new Error('Reconciliation requires identity and evidence');
  if (!Number.isFinite(cashTolerance) || cashTolerance < 0) throw new Error('Invalid cash tolerance');
  validateSnapshot(recorded);
  validateSnapshot(observed);
  if (recorded.accountId !== observed.accountId) throw new Error('Cannot reconcile different accounts');
  if (recorded.currency !== observed.currency) throw new Error('Cannot reconcile different currencies');
  const base = {
    id, accountId: recorded.accountId, asOf: recorded.asOf, evidenceRef,
    recordedSnapshot: copy(recorded), observedSnapshot: copy(observed),
  };
  if (recorded.asOf !== observed.asOf) {
    return { ...base, status: 'PENDING', differences: [], issues: ['valuationDateMismatch'] };
  }
  const differences: { field: string; recorded: number | null; observed: number | null }[] = [];
  const issues: string[] = [];
  let mismatch = false;
  const compare = (field: string, a: number | null, b: number | null, tolerance: number) => {
    if (a === null || b === null) {
      issues.push('unknown:' + field);
      differences.push({ field, recorded: a, observed: b });
    } else if (Math.abs(a - b) > tolerance + Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b))) {
      mismatch = true;
      differences.push({ field, recorded: a, observed: b });
    }
  };
  compare('cash', recorded.cash, observed.cash, cashTolerance);
  if (!recorded.positionsComplete || !observed.positionsComplete) issues.push('incompletePositions');
  const a = new Map(recorded.positions.map(p => [p.symbol, p.quantity]));
  const b = new Map(observed.positions.map(p => [p.symbol, p.quantity]));
  for (const symbol of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const quantity = (map: Map<string, number | null>, complete: boolean) =>
      map.has(symbol) ? map.get(symbol)! : complete ? 0 : null;
    compare('quantity:' + symbol, quantity(a, recorded.positionsComplete), quantity(b, observed.positionsComplete), 0);
  }
  return {
    ...base, status: mismatch ? 'MISMATCH' : issues.length ? 'PENDING' : 'MATCHED',
    differences, issues,
  };
}
