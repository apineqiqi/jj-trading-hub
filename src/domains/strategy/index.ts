export { createStrategyRecord } from '../../data/strategyRecords.js';
export { prepareStrategy, persistStrategy } from '../../data/strategyImport.js';
export type { StrategyRecord } from '../../types/strategy.js';
export interface Trigger {
  readonly id: string;
  readonly kind: 'PRICE_ZONE' | 'ABOVE' | 'BELOW';
  readonly lower: number;
  readonly upper: number;
  readonly holdSeconds?: number;
  readonly confirmation?: string;
}
export interface Invalidation {
  readonly trigger: Trigger;
  readonly reason: string;
}
export interface ActionSuggestion {
  readonly kind: 'OBSERVE' | 'HOLD' | 'REVIEW_ADD' | 'REVIEW_REDUCE';
  readonly rationale: string;
  readonly requiresManualConfirmation: true;
}
export interface StockState {
  readonly id: string;
  readonly label: string;
  readonly zone: Trigger;
  readonly invalidations: readonly Invalidation[];
}
export interface Transition {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly trigger: Trigger;
  readonly invalidations: readonly Invalidation[];
  readonly action: ActionSuggestion;
}
export interface StrategyVersion {
  readonly id: string;
  readonly seriesId: string;
  readonly version: number;
  readonly previousVersionId: string | null;
  readonly accountId: string;
  readonly symbol: string;
  readonly createdAt: string;
  readonly sourceRef: string;
  readonly initialStateId: string;
  readonly states: readonly StockState[];
  readonly transitions: readonly Transition[];
}
export function validateStrategyVersion(strategy: StrategyVersion): string[] {
  const errors: string[] = [];
  if (!strategy.id || !strategy.seriesId || !strategy.accountId || !strategy.symbol || !strategy.sourceRef ||
    !Number.isFinite(Date.parse(strategy.createdAt)) || !Number.isInteger(strategy.version) || strategy.version < 1) errors.push('metadata');
  const ids = new Set(strategy.states.map(state => state.id));
  if (ids.size !== strategy.states.length || ids.has('') || !ids.has(strategy.initialStateId)) errors.push('states');
  const transitions = new Set(strategy.transitions.map(t => t.id));
  if (transitions.size !== strategy.transitions.length || transitions.has('')) errors.push('transitions');
  const check = (trigger: Trigger) => {
    if (!trigger.id || !['PRICE_ZONE', 'ABOVE', 'BELOW'].includes(trigger.kind) ||
      !Number.isFinite(trigger.lower) || !Number.isFinite(trigger.upper) ||
      trigger.lower <= 0 || trigger.upper < trigger.lower ||
      (trigger.kind !== 'PRICE_ZONE' && trigger.lower !== trigger.upper) ||
      (trigger.holdSeconds !== undefined && (!Number.isFinite(trigger.holdSeconds) || trigger.holdSeconds < 0))) errors.push('trigger');
  };
  strategy.states.forEach(state => { check(state.zone); state.invalidations.forEach(i => check(i.trigger)); });
  strategy.transitions.forEach(t => {
    if (!ids.has(t.from) || !ids.has(t.to)) errors.push('transitionReference');
    check(t.trigger);
    t.invalidations.forEach(i => check(i.trigger));
    if (t.action.requiresManualConfirmation !== true ||
      !['OBSERVE', 'HOLD', 'REVIEW_ADD', 'REVIEW_REDUCE'].includes(t.action.kind)) errors.push('action');
  });
  return errors;
}
