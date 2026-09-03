import { Activity, BellRing, Gauge, ShieldCheck } from 'lucide-react';
import { DecisionTable } from './components/DecisionTable';
import { StatCard } from './components/StatCard';
import { WatchTable } from './components/WatchTable';
import { decisions, watchlist } from './data/mock';

export default function App() {
  return <div className="app-shell">
    <header>
      <div><span className="eyebrow">JJ PERSONAL TRADING OS</span><h1>JJ 交易中枢</h1></div>
      <button className="icon-btn" title="提醒"><BellRing size={20}/></button>
    </header>

    <main>
      <section className="hero card">
        <div><span className="eyebrow">2026-09-03 收盘</span><h2>设备 / 测试 / 激光强于光模块核心</h2><p>今日不是 CPO 整体 β 行情，联讯与炬光相对占优；寒武纪仍处等待确认阶段。</p></div>
        <div className="hero-score"><span>今日环境</span><strong>分化</strong></div>
      </section>

      <section className="stats">
        <StatCard title="重点标的" value="6" sub="2 个高优先级" icon={<Activity size={18}/>}/>
        <StatCard title="进攻信号" value="1" sub="联讯仪器强势" icon={<Gauge size={18}/>}/>
        <StatCard title="等待确认" value="2" sub="寒武纪 / 炬光" icon={<ShieldCheck size={18}/>}/>
      </section>

      <WatchTable items={watchlist}/>
      <DecisionTable rows={decisions}/>

      <section className="card checklist">
        <div className="section-title">执行纪律</div>
        <p>新仓必须同时具备：触发价、失效价、仓位动作。事实口径未确认时，只输出条件判断，不给确定性加减仓结论。</p>
        <div className="chips"><span>单股≤35%</span><span>组合≤80%</span><span>单笔风险≤1%</span><span>日亏损≤2%</span><span>计划盈亏比≥2</span></div>
      </section>
    </main>
  </div>
}
