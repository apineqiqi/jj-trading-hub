import { ChevronDown, Settings2, UserRound } from 'lucide-react';
import type { UserProfile } from '../types/market';

export function UserSwitcher({ users, value, onChange, onManage }: { users: UserProfile[]; value: string; onChange: (value: string) => void; onManage: () => void }) {
  const activeUsers = users.filter(user => !user.archived);
  const selected = users.find(user => user.id === value);
  return <div className="user-switcher">
    <UserRound size={16}/><span className="user-dot" style={{ background: selected?.color ?? '#f2b84b' }}/>
    <select aria-label="账户视角" value={value} onChange={event => onChange(event.target.value)}><option value="all">全账户</option>{activeUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
    <ChevronDown size={14}/><button title="管理用户" onClick={onManage}><Settings2 size={15}/></button>
  </div>;
}
