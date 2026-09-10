export * from './types.js';
export * from './validation.js';
export * from './MarketDataService.js';
export * from './legacyAdapter.js';
export { LegacyEastmoneyProvider } from './LegacyEastmoneyProvider.js';
import { LegacyEastmoneyProvider } from './LegacyEastmoneyProvider.js';
import type { MarketDataService } from './MarketDataService.js';
export const marketDataService: MarketDataService = new LegacyEastmoneyProvider();
