import type { StrategyPackage } from './strategyImport';
import type { StrategyArtifactLink, StrategyRecord } from '../types/strategy';

export function createStrategyRecord({ id, userId, importedAt, pack, links, repairs = [] }: {
  id: string;
  userId: string;
  importedAt: string;
  pack: StrategyPackage;
  links: StrategyArtifactLink[];
  repairs?: string[];
}): StrategyRecord {
  return {
    id,
    seriesId: id,
    version: 1,
    userId,
    status: 'active',
    importedAt,
    repairs: [...repairs],
    snapshot: {
      format: pack.format,
      date: pack.date,
      title: pack.title,
      tasks: pack.tasks.map(task => ({ ...task, alert: task.alert ? { ...task.alert } : null })),
    },
    links: links.map(link => ({
      sourceIndex: link.sourceIndex,
      task: { ...link.task },
      alert: { ...link.alert },
    })),
  };
}
