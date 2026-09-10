import { canUseForRealtimeStrategy } from '../market/validation.js';
import type { QuoteValidationPolicy } from '../market/validation.js';
import type { VerifiedQuote } from '../market/types.js';
import { validateStrategyVersion } from './index.js';
import type { ActionSuggestion, StrategyVersion, Trigger } from './index.js';

export interface TransitionEvaluation {
  readonly transitionId: string;
  readonly to: string;
  readonly status: 'NOT_TRIGGERED' | 'PENDING' | 'INVALIDATED' | 'CANDIDATE';
  readonly reasons: readonly string[];
  readonly suggestion: ActionSuggestion | null;
}
export interface StrategyEvaluation {
  readonly strategyId: string;
  readonly strategyVersion: number;
  readonly accountId: string;
  readonly currentStateId: string;
  readonly evaluatedAt: string;
  readonly quoteTime: string | null;
  readonly status: 'BLOCKED' | 'EVALUATED';
  readonly reasons: readonly string[];
  readonly transitions: readonly TransitionEvaluation[];
}

// A snapshot establishes price only. It cannot prove a crossing, continuous
// hold, volume condition, or sector confirmation, even if the last price matches.
function checkTrigger(trigger: Trigger, price: number): 'MISS' | 'PENDING' | 'MATCH' {
  const matches = trigger.kind === 'PRICE_ZONE'
    ? price >= trigger.lower && price <= trigger.upper
    : trigger.kind === 'ABOVE' ? price > trigger.lower : price < trigger.lower;
  if (!matches) return 'MISS';
  if ((trigger.holdSeconds ?? 0) > 0 || trigger.confirmation?.trim()) return 'PENDING';
  return 'MATCH';
}

/** One-hop read-only assessment; never selects a winner or changes current state. */
export function evaluateStrategy(
  strategy: StrategyVersion,
  accountId: string,
  currentStateId: string,
  market: VerifiedQuote,
  policy: QuoteValidationPolicy,
  allowSingleSource = false,
): StrategyEvaluation {
  const base = {
    strategyId: strategy.id, strategyVersion: strategy.version, accountId,
    currentStateId, evaluatedAt: policy.now, quoteTime: market.quote?.quoteTime ?? null,
  };
  const reasons = validateStrategyVersion(strategy);
  if (strategy.accountId !== accountId) reasons.push('accountMismatch');
  if (strategy.symbol !== market.symbol) reasons.push('symbolMismatch');
  const state = strategy.states.find(s => s.id === currentStateId);
  if (!state) reasons.push('unknownCurrentState');
  if (!canUseForRealtimeStrategy(market, policy, allowSingleSource)) reasons.push('marketNotAdmitted');
  if (reasons.length || !state || !market.quote) return { ...base, status: 'BLOCKED', reasons, transitions: [] };
  const price = market.quote.last;
  const transitions = strategy.transitions.filter(t => t.from === currentStateId).map(t => {
    const invalidations = [...state.invalidations, ...t.invalidations]
      .map(i => ({ result: checkTrigger(i.trigger, price), reason: i.reason }));
    const confirmed = invalidations.filter(i => i.result === 'MATCH');
    const uncertain = invalidations.filter(i => i.result === 'PENDING');
    const trigger = checkTrigger(t.trigger, price);
    let status: TransitionEvaluation['status'];
    let reasons: string[] = [];
    if (confirmed.length) {
      status = 'INVALIDATED';
      reasons = confirmed.map(i => 'invalidation:' + i.reason);
    } else if (trigger === 'MISS') {
      status = 'NOT_TRIGGERED';
    } else if (uncertain.length || trigger === 'PENDING') {
      status = 'PENDING';
      reasons = [
        ...uncertain.map(i => 'unconfirmedInvalidation:' + i.reason),
        ...(trigger === 'PENDING' ? ['requiresDurationOrConfirmationEvidence'] : []),
      ];
    } else status = 'CANDIDATE';
    return {
      transitionId: t.id, to: t.to, status, reasons,
      suggestion: status === 'CANDIDATE' ? { ...t.action } : null,
    };
  });
  return { ...base, status: 'EVALUATED', reasons: [], transitions };
}
