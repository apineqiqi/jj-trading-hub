import type { AlertDirection, PriceAlert, WatchItem } from '../types/market';

const values = (text?: string) => text?.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];

const targetFrom = (text: string | undefined, direction: AlertDirection) => {
  const matches = values(text);
  if (!matches.length) return undefined;
  return direction === 'above' ? Math.max(...matches) : Math.min(...matches);
};

export const seedAlertRules = (items: WatchItem[]): PriceAlert[] => items.flatMap(item => {
  const userId = item.userId ?? 'user-jj';
  const createdAt = new Date().toISOString();
  const rules: PriceAlert[] = [];
  const trigger = targetFrom(item.trigger, 'above');
  const invalidation = targetFrom(item.invalidation, 'below');
  if (trigger !== undefined) rules.push({ id: `${userId}-${item.symbol}-trigger`, userId, symbol: item.symbol, name: item.name, direction: 'above', target: trigger, label: item.trigger ?? '突破触发位', enabled: true, acknowledged: false, createdAt });
  if (invalidation !== undefined) rules.push({ id: `${userId}-${item.symbol}-risk`, userId, symbol: item.symbol, name: item.name, direction: 'below', target: invalidation, label: item.invalidation ?? '跌破失效位', enabled: true, acknowledged: false, createdAt });
  return rules;
});
