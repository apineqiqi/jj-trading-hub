import type { AlertDirection, WorkflowPhase } from './market';

export interface StrategySnapshotTask {
  phase: WorkflowPhase;
  title: string;
  detail: string;
  alert: {
    symbol: string;
    name: string;
    direction: AlertDirection;
    target: number;
  } | null;
}

export interface StrategySnapshot {
  format: 'jj-strategy-v1';
  date: string;
  title: string;
  tasks: StrategySnapshotTask[];
}

export type StrategyLinkOutcome = 'created' | 'duplicate' | 'not-selected' | 'not-applicable';

export interface StrategyArtifactLink {
  sourceIndex: number;
  task: { outcome: StrategyLinkOutcome; id?: string };
  alert: { outcome: StrategyLinkOutcome; id?: string };
}

export interface StrategyRecord {
  id: string;
  seriesId: string;
  version: number;
  userId: string;
  status: 'active' | 'superseded' | 'archived';
  importedAt: string;
  repairs?: string[];
  snapshot: StrategySnapshot;
  links: StrategyArtifactLink[];
}
