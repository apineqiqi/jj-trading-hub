import { initialPositions, watchlist as initialWatchlist } from './mock';
import type { Position, UserProfile, WatchItem } from '../types/market';

export const defaultUser: UserProfile = { id: 'user-jj', name: 'JJ', color: '#f2b84b' };
const colors = ['#63b3ff', '#8edb9e', '#ff8c7a', '#b99cff', '#f0cf69'];

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const legacyPositions = () => read<Position[]>('jj-trading-v03-positions', initialPositions);
const legacyWatchlist = () => read<WatchItem[]>('jj-trading-v02-watchlist', initialWatchlist);
const legacyId = (name: string) => `user-legacy-${Array.from(name).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36)}`;

export const migrateUsers = (): UserProfile[] => {
  const names = Array.from(new Set(legacyPositions().map(item => item.owner?.trim()).filter((name): name is string => Boolean(name && name !== '未标记'))));
  const users = names.map((name, index) => name.toLowerCase() === 'jj' ? defaultUser : { id: legacyId(name), name, color: colors[index % colors.length] });
  return users.some(user => user.id === defaultUser.id) ? users : [defaultUser, ...users];
};

export const migratePositions = (): Position[] => {
  const users = migrateUsers();
  return legacyPositions().map(item => {
    const owner = item.owner?.trim();
    const user = users.find(profile => profile.name === owner) ?? defaultUser;
    return { ...item, userId: item.userId ?? user.id, owner: user.name };
  });
};

export const migrateWatchlist = (): WatchItem[] => legacyWatchlist().map(item => ({ ...item, userId: item.userId ?? defaultUser.id }));
