import type { AlertDirection, PriceAlert, RiskPlan } from '../types/market';

export const linkedToPlan = (alert: PriceAlert, plan: RiskPlan) => alert.planId === plan.id && alert.userId === plan.userId;

// Do not infer whether the intended entry is a breakout or a pullback.
export function createPlanAlerts(plan: RiskPlan, direction: AlertDirection, existing: PriceAlert[], now = new Date().toISOString()): PriceAlert[] {
  if (!plan.id || !plan.userId || !/^\d{6}$/.test(plan.symbol) || ![plan.entry, plan.stop, plan.target].every(n => Number.isFinite(n) && n > 0) || plan.stop >= plan.entry || plan.target <= plan.entry) throw new Error('计划价格边界无效，请重新创建计划');
  const levels = [
    { level: 'entry' as const, target: plan.entry, direction, label: '计划入场：仅提示复核条件，不代表已成交' },
    { level: 'stop' as const, target: plan.stop, direction: 'below' as const, label: '计划止损边界：请核对实际持仓与风险' },
    { level: 'target' as const, target: plan.target, direction: 'above' as const, label: '计划目标边界：请复核后续执行安排' },
  ];
  return levels.filter(item => !existing.some(alert => linkedToPlan(alert, plan) && alert.planLevel === item.level)).map(item => ({
    id: crypto.randomUUID(), planId: plan.id, planLevel: item.level, userId: plan.userId,
    symbol: plan.symbol, name: plan.name, direction: item.direction, target: item.target, label: item.label,
    enabled: true, acknowledged: false, createdAt: now,
  }));
}
