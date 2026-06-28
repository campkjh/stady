"use client";

// 클라이언트 SPA 세션 동안 유지되는 가벼운 메모리 캐시(stale-while-revalidate).
// 탭을 오갈 때 컴포넌트가 재마운트되어도, 캐시된 값을 즉시 보여주고
// 백그라운드 재요청 결과가 "달라졌을 때만" 상태를 갱신 → 불필요한 로딩/깜빡임 제거.
const store = new Map<string, unknown>();

export const clientCache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },
  has(key: string): boolean {
    return store.has(key);
  },
  // 값을 저장하고, 직전 값과 달라졌으면 true 반환(달라졌을 때만 setState 하도록).
  set<T>(key: string, value: T): boolean {
    const prev = store.get(key);
    let changed = true;
    try {
      changed = JSON.stringify(prev) !== JSON.stringify(value);
    } catch {
      changed = true;
    }
    store.set(key, value);
    return changed;
  },
  // 데이터 변동(글 작성/삭제 등) 후 해당 캐시를 비워 다음 진입 시 최신으로 다시 불러오게 한다.
  clearPrefix(prefix: string): void {
    for (const k of [...store.keys()]) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },
};
