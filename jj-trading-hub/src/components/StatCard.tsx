import type { ReactNode } from 'react';

export function StatCard({ title, value, sub, icon }: { title: string; value: string; sub: string; icon?: ReactNode }) {
  return (
    <div className="card stat-card">
      <div className="stat-head"><span>{title}</span>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="muted">{sub}</div>
    </div>
  );
}
