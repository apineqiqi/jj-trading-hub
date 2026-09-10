import { BellRing, Check, CircleAlert, Clock3, History, ListChecks, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StrategyRecord } from '../types/strategy';
import type { DailyWorkflow, PriceAlert, UserProfile, WorkflowTask } from '../types/market';

const phaseNames = { pre: '盘前', live: '盘中', close: '收盘' } as const;
const statusNames = { active: '已导入', superseded: '已被替代', archived: '已归档' } as const;

type LinkState = 'exists' | 'modified' | 'removed' | 'duplicate' | 'not-selected' | 'not-applicable';

const linkLabels: Record<LinkState, string> = {
  exists: '存在',
  modified: '已修改',
  removed: '已移除',
  duplicate: '重复',
  'not-selected': '未选',
  'not-applicable': '未提供',
};

const timeLabel = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : value;
};

const taskMatches = (task: WorkflowTask, source: StrategyRecord['snapshot']['tasks'][number]) =>
  task.phase === source.phase && task.title.trim() === source.title.trim() && task.detail.trim() === source.detail.trim();

const alertMatches = (alert: PriceAlert, source: NonNullable<StrategyRecord['snapshot']['tasks'][number]['alert']>) =>
  alert.symbol === source.symbol && alert.name.trim() === source.name.trim() && alert.direction === source.direction && alert.target === source.target;

function artifactState(
  outcome: StrategyRecord['links'][number]['task']['outcome'],
  id: string | undefined,
  exists: boolean,
  matches: boolean,
): LinkState {
  if (outcome !== 'created') return outcome;
  if (!id || !exists) return 'removed';
  return matches ? 'exists' : 'modified';
}

export interface StrategyCenterProps {
  strategies: StrategyRecord[];
  users: UserProfile[];
  selectedUserId: string;
  workflows: DailyWorkflow[];
  alerts: PriceAlert[];
  focusedStrategyId?: string | null;
  onImport: () => void;
}

export function StrategyCenter({ strategies, users, selectedUserId, workflows, alerts, focusedStrategyId, onImport }: StrategyCenterProps) {
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);
  const visibleStrategies = useMemo(() => strategies
    .filter(strategy => selectedUserId === 'all' || strategy.userId === selectedUserId)
    .sort((a, b) => b.snapshot.date.localeCompare(a.snapshot.date) || b.importedAt.localeCompare(a.importedAt)), [strategies, selectedUserId]);
  const [openedId, setOpenedId] = useState<string | null>(focusedStrategyId ?? null);
  const consumedFocus = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (focusedStrategyId && consumedFocus.current !== focusedStrategyId && visibleStrategies.some(strategy => strategy.id === focusedStrategyId)) {
      consumedFocus.current = focusedStrategyId;
      setOpenedId(focusedStrategyId);
      return;
    }
    if (!focusedStrategyId) consumedFocus.current = focusedStrategyId;
    if (!visibleStrategies.some(strategy => strategy.id === openedId)) setOpenedId(visibleStrategies[0]?.id ?? null);
  }, [focusedStrategyId, openedId, visibleStrategies]);

  const opened = visibleStrategies.find(strategy => strategy.id === openedId) ?? visibleStrategies[0];
  const workflowTasks = useMemo(() => workflows.flatMap(workflow => (workflow.customTasks ?? []).map(task => ({ workflow, task }))), [workflows]);
  const taskById = useMemo(() => new Map(workflowTasks.map(item => [item.task.id, item])), [workflowTasks]);
  const alertById = useMemo(() => new Map(alerts.map(alert => [alert.id, alert])), [alerts]);
  const legacy = useMemo(() => {
    const taskRows = workflowTasks.filter(({ workflow, task }) =>
      (selectedUserId === 'all' || workflow.userId === selectedUserId) && task.sourceTitle && !task.strategyId);
    const alertRows = alerts.filter(alert =>
      (selectedUserId === 'all' || alert.userId === selectedUserId) && alert.sourceTitle && !alert.strategyId);
    const titles = Array.from(new Set([...taskRows.map(({ task }) => task.sourceTitle!), ...alertRows.map(alert => alert.sourceTitle!)]));
    return { tasks: taskRows.length, alerts: alertRows.length, titles };
  }, [alerts, selectedUserId, workflowTasks]);

  const activeCount = visibleStrategies.filter(strategy => strategy.status === 'active').length;
  const createdTaskCount = visibleStrategies.reduce((sum, strategy) => sum + strategy.links.filter(link => link.task.outcome === 'created').length, 0);
  const createdAlertCount = visibleStrategies.reduce((sum, strategy) => sum + strategy.links.filter(link => link.alert.outcome === 'created').length, 0);

  return <section className="strategy-center-page">
    <header className="strategy-center-hero">
      <div>
        <span className="eyebrow">STRATEGY ARCHIVE · V1.6</span>
        <h2>策略中心</h2>
        <p>保留每次 AI 策略导入的原始决策快照，并核对它在交易日任务与提醒中心里的实际去向。</p>
      </div>
      <button className="primary-btn strategy-center-import" onClick={onImport}><Plus size={15}/>导入新策略</button>
    </header>

    <div className="strategy-center-summary" aria-label="策略档案摘要">
      <article><History size={17}/><span><b>{visibleStrategies.length}</b><small>策略档案</small></span><em>{activeCount} 份导入记录</em></article>
      <article><ListChecks size={17}/><span><b>{createdTaskCount}</b><small>关联任务</small></span><em>以导入记录为准</em></article>
      <article><BellRing size={17}/><span><b>{createdAlertCount}</b><small>关联提醒</small></span><em>暂停也保留来源</em></article>
    </div>

    {!!(legacy.tasks + legacy.alerts) && <aside className="strategy-legacy-note" role="note">
      <CircleAlert size={18}/>
      <div><b>有 AI 对话来源尚未建立策略档案</b><p>普通 ChatGPT 导入或旧版本遗留的 {legacy.tasks} 项任务、{legacy.alerts} 条提醒仍然保留，但只有来源标题，不能可靠归入某次结构化策略导入。</p>{legacy.titles.length > 0 && <small>未归档来源：{legacy.titles.slice(0, 3).join('、')}{legacy.titles.length > 3 ? ` 等 ${legacy.titles.length} 个` : ''}</small>}</div>
    </aside>}

    {visibleStrategies.length ? <div className="strategy-center-layout">
      <aside className="strategy-archive-list" aria-label="策略档案列表">
        <div className="strategy-archive-list-head"><span>档案索引</span><small>{selectedUserId === 'all' ? '全部账户' : userMap.get(selectedUserId)?.name ?? '当前账户'}</small></div>
        {visibleStrategies.map(strategy => {
          const selected = strategy.id === opened?.id;
          const createdTasks = strategy.links.filter(link => link.task.outcome === 'created').length;
          const createdAlerts = strategy.links.filter(link => link.alert.outcome === 'created').length;
          return <button key={strategy.id} className={`strategy-archive-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setOpenedId(strategy.id)}>
            <span className="strategy-card-rail"/>
            <span className="strategy-card-top"><em>{statusNames[strategy.status]}</em><small>V{strategy.version}</small></span>
            <b>{strategy.snapshot.title}</b>
            <span className="strategy-card-meta"><UsersRound size={12}/>{userMap.get(strategy.userId)?.name ?? '未知账户'}<i/>适用 {strategy.snapshot.date}</span>
            <span className="strategy-card-counts">{createdTasks} 项任务 · {createdAlerts} 条提醒</span>
          </button>;
        })}
      </aside>

      {opened && <article className="strategy-record" aria-label={`策略详情 ${opened.snapshot.title}`}>
        <div className="strategy-record-head">
          <div><span className="eyebrow">IMMUTABLE SNAPSHOT</span><h3>{opened.snapshot.title}</h3><p><UsersRound size={13}/>{userMap.get(opened.userId)?.name ?? '未知账户'}<i/>适用日期 {opened.snapshot.date}<i/>策略 V{opened.version}</p></div>
          <span className={`strategy-record-status ${opened.status}`}>{statusNames[opened.status]}</span>
        </div>
        <div className="strategy-record-audit"><ShieldCheck size={16}/><span><b>不可变策略快照</b><small>下方内容保留导入时原文；交易日内的编辑不会反向改写这里。</small></span><time><Clock3 size={12}/>导入于 {timeLabel(opened.importedAt)}</time></div>
        {!!opened.repairs?.length && <p className="strategy-record-repairs">导入时已修复：{opened.repairs.join('、')}</p>}

        <div className="strategy-snapshot-list">
          {opened.snapshot.tasks.map((source, index) => {
            const link = opened.links.find(item => item.sourceIndex === index);
            const taskEntry = link?.task.id ? taskById.get(link.task.id) : undefined;
            const taskState = link ? artifactState(link.task.outcome, link.task.id, !!taskEntry, !!taskEntry && taskMatches(taskEntry.task, source)) : 'not-selected';
            const alertEntry = link?.alert.id ? alertById.get(link.alert.id) : undefined;
            const alertState = link ? artifactState(link.alert.outcome, link.alert.id, !!alertEntry, !!alertEntry && !!source.alert && alertMatches(alertEntry, source.alert)) : source.alert ? 'not-selected' : 'not-applicable';
            return <section className="strategy-snapshot-task" key={`${opened.id}-${index}`}>
              <div className="strategy-task-index"><span>{String(index + 1).padStart(2, '0')}</span><em>{phaseNames[source.phase]}</em></div>
              <div className="strategy-task-copy"><h4>{source.title}</h4><p>{source.detail}</p>{source.alert && <div className="strategy-source-alert"><BellRing size={13}/><span>{source.alert.name} · {source.alert.symbol}</span><b>{source.alert.direction === 'above' ? '≥' : '≤'} {source.alert.target}</b></div>}</div>
              <div className="strategy-link-states" aria-label={`第 ${index + 1} 项产物状态`}>
                <span className={taskState}><ListChecks size={12}/>任务 · {linkLabels[taskState]}</span>
                <span className={alertState}><BellRing size={12}/>提醒 · {linkLabels[alertState]}</span>
              </div>
            </section>;
          })}
        </div>
      </article>}
    </div> : <div className="strategy-center-empty">
      <span><History size={28}/></span><b>还没有策略档案</b><p>从 AI 策略快导导入第一份结构化策略后，这里会保存来源、不可变原文与执行产物状态。</p><button className="primary-btn" onClick={onImport}><Plus size={15}/>导入第一份策略</button>
    </div>}
  </section>;
}
