type Validator = (value: unknown) => boolean;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const str: Validator = value => typeof value === 'string';
const nonEmpty: Validator = value => typeof value === 'string' && !!value.trim();
const num: Validator = value => typeof value === 'number' && Number.isFinite(value);
const bool: Validator = value => typeof value === 'boolean';
const optional = (test: Validator): Validator => value => value === undefined || test(value);
const choice = (...values: string[]): Validator => value => typeof value === 'string' && values.includes(value);
const fields = (schema: Record<string, Validator>): Validator => value => object(value) && Object.entries(schema).every(([key, test]) => test(value[key]));
const rows = (schema: Record<string, Validator>): Validator => value => Array.isArray(value) && value.every(fields(schema));
const dictionary = (test: Validator): Validator => value => object(value) && Object.values(value).every(test);
const stringRows: Validator = value => Array.isArray(value) && value.every(str);
const alertSpec: Validator = value => value === null || fields({ symbol: value => typeof value === 'string' && /^\d{6}$/.test(value), name: nonEmpty, direction: choice('above', 'below'), target: value => num(value) && Number(value) > 0 })(value);
const strategyTasks: Validator = value => Array.isArray(value) && value.length > 0 && value.length <= 200 && value.every(fields({ phase: choice('pre', 'live', 'close'), title: nonEmpty, detail: nonEmpty, alert: alertSpec }));
const linkSide: Validator = fields({ outcome: choice('created', 'duplicate', 'not-selected', 'not-applicable'), id: optional(str) });
const strategyLinks: Validator = value => Array.isArray(value) && value.every(fields({ sourceIndex: num, task: linkSide, alert: linkSide }));
const user = { userId: optional(str) };
const validators: Record<string, Validator> = {
  'jj-trading-v06-users': rows({ id: str, name: str, color: str, archived: optional(bool) }),
  'jj-trading-v06-active-user': str,
  'jj-trading-v06-positions': rows({ id: str, ...user, symbol: str, name: str, shares: num, cost: num, price: num, reportedMarketValue: optional(num), reportedPnl: optional(num), reportedReturnPct: optional(num) }),
  'jj-trading-v06-watchlist': rows({ ...user, symbol: str, name: str, price: num, changePct: num, group: str, score: num, state: str, note: str, support: optional(str), trigger: optional(str), invalidation: optional(str) }),
  'jj-trading-v04-snapshots': rows({ id: str, ...user, date: str, totalAssets: num, marketValue: num, cash: num, unrealizedPnl: num, note: optional(str) }),
  'jj-trading-v04-trades': rows({ id: str, ...user, date: str, side: choice('买入', '卖出'), symbol: str, name: str, shares: num, price: num, fee: optional(num), note: optional(str) }),
  'jj-trading-privacy-mode': bool,
  'jj-trading-v07-workflows': rows({ id: str, userId: str, date: str, checks: dictionary(bool), notes: dictionary(str), updatedAt: str, customTasks: optional(rows({ id: str, phase: choice('pre', 'live', 'close'), title: str, detail: str, sourceTitle: optional(str), importedAt: optional(str), strategyId: optional(str), sourceTaskIndex: optional(num) })) }),
  'jj-trading-v08-alerts': rows({ id: str, userId: str, symbol: str, name: str, direction: choice('above', 'below'), target: num, label: str, enabled: bool, acknowledged: bool, createdAt: str, planId: optional(str), planLevel: optional(choice('entry', 'stop', 'target')), sourceTitle: optional(str), strategyId: optional(str), sourceTaskIndex: optional(num) }),
  'jj-trading-v09-visual-reviews': rows({ id: str, userId: str, date: str, symbol: str, name: str, moment: choice('pre', 'live', 'close'), bias: choice('bullish', 'neutral', 'bearish'), imageDataUrl: value => typeof value === 'string' && /^data:image\/(webp|png|jpeg);base64,/.test(value), imageName: str, fact: str, judgment: str, nextCondition: str, createdAt: str }),
  'jj-trading-v10-risk-profiles': rows({ userId: str, singlePositionPct: num, portfolioPct: num, tradeRiskPct: num, dailyLossPct: num }),
  'jj-trading-v10-risk-plans': rows({ id: str, userId: str, symbol: str, name: str, entry: num, stop: num, target: num, shares: num, riskAmount: num, capital: num, rewardRiskRatio: num, createdAt: str }),
  'jj-trading-v12-cash': dictionary(value => num(value) && Number(value) >= 0),
  'jj-trading-v16-strategies': rows({ id: nonEmpty, seriesId: nonEmpty, version: num, userId: nonEmpty, status: choice('active', 'superseded', 'archived'), importedAt: str, repairs: optional(stringRows), snapshot: fields({ format: choice('jj-strategy-v1'), date: str, title: nonEmpty, tasks: strategyTasks }), links: strategyLinks }),
};

export type BackupData = Record<string, unknown>;
export function parseBackup(raw: string): { data: BackupData; createdAt: string } {
  const parsed: unknown = JSON.parse(raw);
  if (!object(parsed) || parsed.app !== 'jj-trading-hub' || ![12, 13, 14, 15, 16].includes(Number(parsed.version)) || typeof parsed.version !== 'number' || !object(parsed.data) || typeof parsed.createdAt !== 'string') throw new Error('请选择 V1.2–V1.6 导出的完整备份文件');
  const data: BackupData = { ...parsed.data };
  if (parsed.version <= 15 && data['jj-trading-v16-strategies'] === undefined) data['jj-trading-v16-strategies'] = [];
  if (Object.keys(data).length !== Object.keys(validators).length || !Object.entries(validators).every(([key, test]) => test(data[key]))) throw new Error('备份内容不完整或字段无效，未修改本机数据');
  const users = data['jj-trading-v06-users'] as Array<{ id: string }>;
  const ids = new Set(users.map(item => item.id));
  if (!ids.size || ids.size !== users.length) throw new Error('备份账户为空或有重复编号');
  if (!Number.isFinite(Date.parse(parsed.createdAt))) throw new Error('备份日期无效');
  if (Object.keys(data['jj-trading-v12-cash'] as Record<string, unknown>).some(id => !ids.has(id))) throw new Error('现金记录无法对应到账户');
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.some(item => object(item) && item.userId !== undefined && !ids.has(String(item.userId)))) throw new Error('备份中存在无法对应到账户的记录');
    if (Array.isArray(value)) {
      const recordIds = value.filter(object).filter(item => typeof item.id === 'string').map(item => item.id);
      if (new Set(recordIds).size !== recordIds.length) throw new Error('备份中存在重复记录编号');
    }
  }
  const plans = data['jj-trading-v10-risk-plans'] as Array<{ id: string; userId: string; symbol: string }>;
  const linked = new Set<string>();
  for (const alert of data['jj-trading-v08-alerts'] as Array<{ userId: string; symbol: string; planId?: string; planLevel?: string }>) {
    if (alert.planId === undefined && alert.planLevel === undefined) continue;
    if (!alert.planId || !alert.planLevel || !plans.some(plan => plan.id === alert.planId && plan.userId === alert.userId && plan.symbol === alert.symbol)) throw new Error('计划提醒的账户、标的或来源无效');
    const key = JSON.stringify([alert.userId, alert.planId, alert.planLevel]);
    if (linked.has(key)) throw new Error('同一计划存在重复的价格边界提醒');
    linked.add(key);
  }
  const strategies = data['jj-trading-v16-strategies'] as Array<{ id: string; seriesId: string; version: number; userId: string; importedAt: string; snapshot: { date: string; title: string; tasks: unknown[] }; links: Array<{ sourceIndex: number; task: { outcome: string; id?: string }; alert: { outcome: string; id?: string } }> }>;
  const strategyMap = new Map(strategies.map(item => [item.id, item]));
  const revisions = new Set<string>();
  const seriesOwners = new Map<string, string>();
  const linkedArtifactIds = new Set<string>();
  strategies.forEach(strategy => {
    if (!Number.isInteger(strategy.version) || strategy.version < 1 || !Number.isFinite(Date.parse(strategy.importedAt)) || !/^\d{4}-\d{2}-\d{2}$/.test(strategy.snapshot.date) || !Number.isFinite(Date.parse(strategy.snapshot.date)) || new Date(strategy.snapshot.date).toISOString().slice(0, 10) !== strategy.snapshot.date) throw new Error('策略版本、日期或导入时间无效');
    const seriesOwner = seriesOwners.get(strategy.seriesId);
    if (seriesOwner && seriesOwner !== strategy.userId) throw new Error('策略系列不能跨账户关联');
    seriesOwners.set(strategy.seriesId, strategy.userId);
    const revision = JSON.stringify([strategy.seriesId, strategy.version]);
    if (revisions.has(revision)) throw new Error('同一策略系列存在重复版本');
    revisions.add(revision);
    const indexes = new Set<number>();
    strategy.links.forEach(link => {
      if (!Number.isInteger(link.sourceIndex) || link.sourceIndex < 0 || link.sourceIndex >= strategy.snapshot.tasks.length || indexes.has(link.sourceIndex)) throw new Error('策略条目来源位置无效或重复');
      indexes.add(link.sourceIndex);
      const source = strategy.snapshot.tasks[link.sourceIndex] as { alert: unknown };
      if (link.task.outcome === 'not-applicable' || ((source.alert === null) !== (link.alert.outcome === 'not-applicable'))) throw new Error('策略条目与产物状态不一致');
      for (const side of [link.task, link.alert]) {
        if ((side.outcome === 'created') !== !!side.id) throw new Error('策略产物链接状态无效');
        if (side.id) {
          const artifact = `${side === link.task ? 'task' : 'alert'}:${side.id}`;
          if (linkedArtifactIds.has(artifact)) throw new Error('策略产物被重复关联');
          linkedArtifactIds.add(artifact);
        }
      }
    });
    if (strategy.links.length !== strategy.snapshot.tasks.length) throw new Error('策略条目与来源链接数量不一致');
  });
  const taskMap = new Map<string, { id: string; userId: string; date: string; strategyId?: string; sourceTaskIndex?: number }>();
  for (const workflow of data['jj-trading-v07-workflows'] as Array<{ userId: string; date: string; customTasks?: Array<{ id: string; strategyId?: string; sourceTaskIndex?: number }> }>) {
    for (const task of workflow.customTasks ?? []) {
      if (taskMap.has(task.id)) throw new Error('备份中存在重复任务编号');
      taskMap.set(task.id, { ...task, userId: workflow.userId, date: workflow.date });
      if (!task.strategyId) {
        if (task.sourceTaskIndex !== undefined) throw new Error('任务存在无策略来源的位置标记');
        continue;
      }
      const strategy = strategyMap.get(task.strategyId);
      const link = strategy?.links.find(item => item.sourceIndex === task.sourceTaskIndex);
      if (!strategy || strategy.userId !== workflow.userId || strategy.snapshot.date !== workflow.date || (task as { sourceTitle?: string }).sourceTitle !== strategy.snapshot.title || !Number.isInteger(task.sourceTaskIndex) || link?.task.outcome !== 'created' || link.task.id !== task.id) throw new Error('策略任务的账户、日期或来源无效');
    }
  }
  const alertMap = new Map((data['jj-trading-v08-alerts'] as Array<{ id: string; userId: string; planId?: string; strategyId?: string; sourceTaskIndex?: number }>).map(alert => [alert.id, alert]));
  for (const alert of alertMap.values()) {
    if (!alert.strategyId) {
      if (alert.sourceTaskIndex !== undefined) throw new Error('提醒存在无策略来源的位置标记');
      continue;
    }
    if (alert.planId) throw new Error('提醒不能同时关联策略和风控计划');
    const strategy = strategyMap.get(alert.strategyId);
    const link = strategy?.links.find(item => item.sourceIndex === alert.sourceTaskIndex);
    if (!strategy || strategy.userId !== alert.userId || (alert as { sourceTitle?: string }).sourceTitle !== strategy.snapshot.title || !Number.isInteger(alert.sourceTaskIndex) || link?.alert.outcome !== 'created' || link.alert.id !== alert.id) throw new Error('策略提醒的账户或来源无效');
  }
  strategies.forEach(strategy => strategy.links.forEach(link => {
    if (link.task.id) {
      const task = taskMap.get(link.task.id);
      if (task && (task.strategyId !== strategy.id || task.userId !== strategy.userId || task.sourceTaskIndex !== link.sourceIndex)) throw new Error('策略任务反向链接无效');
    }
    if (link.alert.id) {
      const alert = alertMap.get(link.alert.id);
      if (alert && (alert.strategyId !== strategy.id || alert.userId !== strategy.userId || alert.sourceTaskIndex !== link.sourceIndex)) throw new Error('策略提醒反向链接无效');
    }
  }));
  return { data, createdAt: parsed.createdAt };
}

export function downloadBackup(data: BackupData, suffix = '') {
  const blob = new Blob([JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `jj-trading-v1.6-${new Date().toISOString().replace(/[:.]/g, '-')}${suffix}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function restoreBackup(data: BackupData) {
  // Validate even when called outside the preview UI.
  parseBackup(JSON.stringify({ app: 'jj-trading-hub', version: 16, createdAt: new Date().toISOString(), data }));
  const previous = Object.keys(validators).map(key => [key, localStorage.getItem(key)] as const);
  try {
    Object.keys(validators).forEach(key => localStorage.setItem(key, JSON.stringify(data[key])));
  } catch {
    let rolledBack = true;
    previous.forEach(([key, value]) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { rolledBack = false; } });
    throw new Error(rolledBack ? '恢复写入失败，已保留原数据。请检查存储空间。' : '恢复写入失败，部分数据无法回退。请保留页面并使用恢复前备份。');
  }
}
