import { useEffect, useState, useSyncExternalStore } from 'react';

const failures = new Map<string, string>();
const listeners = new Set<() => void>();
let saveStatus = '正在保存';
const notify = () => {
  saveStatus = failures.size ? `保存失败：${Array.from(failures.values())[0]}` : '本机已保存';
  listeners.forEach(listener => listener());
};
export function useSaveStatus() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => saveStatus);
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) as T : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      failures.delete(key);
    } catch {
      failures.set(key, '存储空间不足或浏览器禁止写入，请立即导出备份');
    }
    notify();
  }, [key, value]);

  return [value, setValue] as const;
}
