import type { Position, TradeRecord, UserProfile } from '../../types/market.js';
export interface PortfolioAccount {
  readonly id: string;
  readonly name: string;
  readonly currency: 'CNY' | 'USD';
  readonly availableCash: number | null;
}
export interface TradeLedgerEntry {
  readonly id: string;
  readonly accountId: string | null;
  readonly symbol: string;
  readonly occurredAt: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: number;
  readonly price: number;
  readonly fee: number | null;
  readonly source: 'LEGACY_MANUAL' | 'BROKER';
  readonly postingStatus: 'RECORD_ONLY';
}
export interface CashLedgerEntry {
  readonly id: string;
  readonly accountId: string;
  readonly occurredAt: string;
  readonly currency: PortfolioAccount['currency'];
  readonly amount: number;
  readonly kind: 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT';
  readonly source: string;
}
export interface PositionSnapshot {
  readonly id: string;
  readonly accountId: string | null;
  readonly asOf: string;
  readonly source: 'LEGACY_MANUAL';
  readonly position: Readonly<Position>;
}
export interface ReconciliationRecord {
  readonly id: string;
  readonly accountId: string;
  readonly asOf: string;
  readonly status: 'PENDING' | 'MATCHED' | 'MISMATCH';
  readonly evidenceRef: string;
  readonly differences: readonly { field: string; recorded: number | null; observed: number | null }[];
}
const validDate = (value: string) => Number.isFinite(Date.parse(value));
export function validateTradeLedgerEntry(entry: TradeLedgerEntry): string[] {
  const errors: string[] = [];
  if (!entry.id || !entry.symbol || (entry.accountId !== null && !entry.accountId)) errors.push('identity');
  if (!validDate(entry.occurredAt)) errors.push('occurredAt');
  if (!['BUY', 'SELL'].includes(entry.side)) errors.push('side');
  if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) errors.push('quantity');
  if (!Number.isFinite(entry.price) || entry.price <= 0) errors.push('price');
  if (entry.fee !== null && (!Number.isFinite(entry.fee) || entry.fee < 0)) errors.push('fee');
  if (entry.postingStatus !== 'RECORD_ONLY') errors.push('postingStatus');
  if (!['LEGACY_MANUAL', 'BROKER'].includes(entry.source)) errors.push('source');
  return errors;
}
export function validateCashLedgerEntry(entry: CashLedgerEntry): string[] {
  const errors: string[] = [];
  if (!entry.id || !entry.accountId || !entry.source) errors.push('identity');
  if (!validDate(entry.occurredAt)) errors.push('occurredAt');
  if (!['CNY', 'USD'].includes(entry.currency)) errors.push('currency');
  if (!['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT'].includes(entry.kind)) errors.push('kind');
  if (!Number.isFinite(entry.amount) || entry.amount === 0 ||
    (entry.kind === 'DEPOSIT' && entry.amount < 0) ||
    (entry.kind === 'WITHDRAWAL' && entry.amount > 0)) errors.push('amount');
  return errors;
}
export function fromLegacyTrade(trade: TradeRecord): TradeLedgerEntry {
  return {
    id: trade.id, accountId: trade.userId ?? null, symbol: trade.symbol,
    occurredAt: trade.date, side: trade.side === '买入' ? 'BUY' : 'SELL',
    quantity: trade.shares, price: trade.price, fee: trade.fee ?? null,
    source: 'LEGACY_MANUAL', postingStatus: 'RECORD_ONLY',
  };
}
export function fromLegacyAccount(user: UserProfile, cash: number | undefined): PortfolioAccount {
  return { id: user.id, name: user.name, currency: 'CNY', availableCash: cash ?? null };
}
export function fromLegacyPosition(position: Position, asOf: string): PositionSnapshot {
  return { id: position.id, accountId: position.userId ?? null, asOf, source: 'LEGACY_MANUAL', position: { ...position } };
}
