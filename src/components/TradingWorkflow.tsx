import { Check, ChevronRight, Circle, Clock3, MoonStar, RotateCcw, ShieldAlert, Sunrise, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DailyWorkflow, WorkflowPhase } from '../types/market';

const phases: Array<{ id: WorkflowPhase; label: string; time: string; kicker: string; icon: typeof Sunrise; tasks: Array<{ id: string; title: string; detail: string }> }> = [
  { id: 'pre', label: '盘前', time: '开盘前', kicker: 'PRE-MARKET', icon: Sunrise, tasks: [
    { id: 'pre-market', title: '判断今日市场环境', detail: '只选趋势、震荡或分化，不预设单边答案。' },
    { id: 'pre-holdings', title: '检查持仓隔夜风险', detail: '核对公告、跳空预期与需要优先处理的仓位。' },
    { id: 'pre-levels', title: '确认触发价与失效价', detail: '每个计划都必须能回答何时做、错了怎么办。' },
    { id: 'pre-budget', title: '锁定今日风险预算', detail: '先定最大亏损，再决定允许投入的仓位。' },
  ] },
  { id: 'live', label: '盘中', time: '09:30–15:00', kicker: 'LIVE SESSION', icon: Zap, tasks: [
    { id: 'live-open', title: '完成开盘 30 分钟观察', detail: '先确认量价与板块强弱，不因第一波波动追单。' },
    { id: 'live-trigger', title: '只执行已触发计划', detail: '没有进入预设价格区间，就继续等待。' },
    { id: 'live-risk', title: '复核组合风险敞口', detail: '加仓前检查单股、总仓位与当日亏损上限。' },
    { id: 'live-record', title: '记录临时决策理由', detail: '偏离盘前计划时，必须留下原因和失效条件。' },
  ] },
  { id: 'close', label: '收盘', time: '15:00 后', kicker: 'CLOSE REVIEW', icon: MoonStar, tasks: [
    { id: 'close-sync', title: '同步收盘价格与账户', detail: '确认持仓数量、现金与行情时间口径一致。' },
    { id: 'close-trades', title: '补全今日交易日志', detail: '动作、价格、费用与执行理由缺一不可。' },
    { id: 'close-review', title: '复盘执行而非盈亏', detail: '区分计划内亏损和计划外盈利，修正行为偏差。' },
    { id: 'close-tomorrow', title: '生成明日观察清单', detail: '只保留有明确触发条件和失效边界的机会。' },
  ] },
];

const phaseForNow = (): WorkflowPhase => {
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  return minute < 570 ? 'pre' : minute < 900 ? 'live' : 'close';
};

interface Props {
  record: DailyWorkflow;
  ownerName: string;
  positions: number;
  attackSignals: number;
  positionPct: number;
  hidden: boolean;
  onChange: (record: DailyWorkflow) => void;
}

export function TradingWorkflow({ record, ownerName, positions, attackSignals, positionPct, hidden, onChange }: Props) {
  const [activePhase, setActivePhase] = useState<WorkflowPhase>(phaseForNow());
  const active = phases.find(item => item.id === activePhase) ?? phases[0];
  const allTasks = useMemo(() => phases.flatMap(item => item.tasks), []);
  const completed = allTasks.filter(item => record.checks[item.id]).length;
  const phaseDone = (phase: typeof phases[number]) => phase.tasks.filter(item => record.checks[item.id]).length;
  const update = (next: Partial<DailyWorkflow>) => onChange({ ...record, ...next, updatedAt: new Date().toISOString() });
  const toggle = (id: string) => update({ checks: { ...record.checks, [id]: !record.checks[id] } });
  const ActiveIcon = active.icon;

  return <section className="workflow-page">
    <div className="workflow-hero">
      <div>
        <span className="eyebrow">TRADING DAY COMMAND · V0.7</span>
        <h2>今天，只执行有边界的决定</h2>
        <p>{record.date} · {ownerName} 的独立交易日流程。完成状态与阶段备注仅保存在当前浏览器。</p>
      </div>
      <div className="workflow-progress" aria-label={`今日完成 ${completed} / ${allTasks.length}`}>
        <strong>{completed}<i>/{allTasks.length}</i></strong>
        <span>今日完成</span>
        <div><i style={{ width: `${completed / allTasks.length * 100}%` }}/></div>
      </div>
    </div>

    <div className="phase-rail" aria-label="交易日阶段">
      {phases.map((phase, index) => {
        const done = phaseDone(phase);
        const PhaseIcon = phase.icon;
        return <button key={phase.id} className={`${activePhase === phase.id ? 'active' : ''} ${done === phase.tasks.length ? 'complete' : ''}`} onClick={() => setActivePhase(phase.id)}>
          <span className="phase-index">0{index + 1}</span><PhaseIcon size={18}/><span><b>{phase.label}</b><small>{phase.time}</small></span><em>{done}/{phase.tasks.length}</em>
        </button>;
      })}
    </div>

    <div className="workflow-grid">
      <article className="card workflow-checks">
        <div className="workflow-card-head">
          <div><span className="eyebrow">{active.kicker}</span><h3><ActiveIcon size={20}/>{active.label}执行清单</h3></div>
          <span className="phase-counter">{phaseDone(active)} / {active.tasks.length}</span>
        </div>
        <div className="task-list">
          {active.tasks.map(task => <button key={task.id} className={record.checks[task.id] ? 'done' : ''} onClick={() => toggle(task.id)}>
            <span className="task-check">{record.checks[task.id] ? <Check size={16}/> : <Circle size={16}/>}</span>
            <span><b>{task.title}</b><small>{task.detail}</small></span><ChevronRight size={15}/>
          </button>)}
        </div>
        <label className="phase-note"><span>阶段记录</span><textarea value={record.notes[activePhase] ?? ''} onChange={event => update({ notes: { ...record.notes, [activePhase]: event.target.value } })} placeholder={`${active.label}发生了什么？记录事实、偏差和下一步。`}/></label>
      </article>

      <aside className="workflow-side">
        <article className="card exposure-card">
          <div className="section-title"><ShieldAlert size={18}/>当前风险仪表</div>
          <div className="exposure-row"><span>持仓数量</span><b>{hidden ? '••' : positions}</b></div>
          <div className="exposure-row"><span>当前仓位</span><b>{hidden ? '••••' : `${positionPct.toFixed(1)}%`}</b></div>
          <div className="exposure-row"><span>转强信号</span><b className={attackSignals ? 'warn' : ''}>{attackSignals}</b></div>
          <div className="risk-line"><i style={{ width: `${Math.min(positionPct, 100)}%` }}/><span>组合上限 80%</span></div>
        </article>
        <article className="card session-card">
          <Clock3 size={18}/><span className="eyebrow">CURRENT PROTOCOL</span><b>{active.label}阶段</b>
          <p>{activePhase === 'pre' ? '先定义条件，再等待市场回答。' : activePhase === 'live' ? '价格触发计划，风险决定仓位。' : '评价过程，留下明天能复用的证据。'}</p>
          <button className="reset-workflow" onClick={() => window.confirm('重置今天的全部流程进度与备注？') && update({ checks: {}, notes: {} })}><RotateCcw size={14}/>重置今日流程</button>
        </article>
      </aside>
    </div>
  </section>;
}
