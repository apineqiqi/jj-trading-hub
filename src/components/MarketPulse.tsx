import { Radio, RefreshCw } from 'lucide-react';

export type QuoteStatus = 'loading' | 'success' | 'error';

export function MarketPulse({ status, updatedAt, count, message, onRefresh }: {
  status: QuoteStatus;
  updatedAt?: string;
  count: number;
  message?: string;
  onRefresh: () => void;
}) {
  const displayTime = updatedAt
    ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(updatedAt))
    : '等待首次同步';
  const label = status === 'loading' ? '正在同步行情' : status === 'error' ? '行情暂不可用' : `已同步 ${count} 个标的`;

  return <section className={`market-pulse ${status}`} aria-live="polite">
    <div className="pulse-signal"><Radio size={15}/><i></i></div>
    <div className="pulse-copy"><b>{label}</b><span>{status === 'error' ? message : `公开延迟行情 · ${displayTime}`}</span></div>
    <div className="pulse-source">东方财富行情</div>
    <button className="quote-refresh" onClick={onRefresh} disabled={status === 'loading'}>
      <RefreshCw size={14}/><span>{status === 'loading' ? '同步中' : '刷新行情'}</span>
    </button>
  </section>;
}
