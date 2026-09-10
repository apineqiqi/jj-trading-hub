import type { VerifiedQuote } from '../market/types.js';
import type { PortfolioAccount, PositionSnapshot, TradeLedgerEntry } from '../portfolio/index.js';
import type { StrategyVersion } from '../strategy/index.js';
// Read-only input contract. AI and Web context cannot write any Truth domain.
export interface DecisionContext {
  readonly market: readonly VerifiedQuote[];
  readonly account: PortfolioAccount;
  readonly positions: readonly PositionSnapshot[];
  readonly strategy: StrategyVersion | null;
  readonly executions: readonly TradeLedgerEntry[];
  readonly newsContext: readonly { readonly sourceUrl: string; readonly text: string }[];
}
