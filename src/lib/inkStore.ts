"use client";

// 모의고사 필기(페이지별 PNG dataURL) 저장소.
//
// 예전엔 localStorage 에만 뒀는데, 기기당 5MB 남짓이라 금방 찼다(옛 버전이 손대지 않은 빈 페이지까지
// 장당 ~100KB 씩 저장해 둔 것도 그대로 남아 있다). 차면 setItem 이 조용히 실패하고, 화면 밖 페이지는
// 저장 직후 캔버스를 반납하므로 "위로 올라갔다 오면·나갔다 오면 필기가 사라짐"이 됐다(아이패드 신고).
//  · 메모리 캐시: 앱이 켜져 있는 동안은 저장 실패와 상관없이 되살린다(스크롤·화면 이동).
//  · IndexedDB: 용량이 수백 MB 단위라 앱을 껐다 켜도 남는다.
//  · 옛 localStorage 값은 처음 열 때 IndexedDB 로 옮기고 지운다(다른 기능의 localStorage 공간도 돌려준다).

const PREFIX = "mockexam_";
const DB_NAME = "stady-ink";
const STORE = "ink";

// 값: dataURL = 필기 있음, "" = 없음으로 확인됨. 키 없음 = 아직 모름.
const mem = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        resolve(db);
        migrateLegacy(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbWrite(db: IDBDatabase, apply: (store: IDBObjectStore) => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      apply(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

const isInk = (v: string | null | undefined): v is string => !!v && v.startsWith("data:image/");

// 옛 localStorage 필기를 IndexedDB 로 옮긴다. 옮겨진 게 확인된 뒤에만 지운다.
function migrateLegacy(db: IDBDatabase) {
  let entries: [string, string][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      entries.push([k, localStorage.getItem(k) ?? ""]);
    }
  } catch {
    return;
  }
  if (entries.length === 0) return;
  entries = entries.filter(([k, v]) => {
    if (isInk(v)) return true;
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    return false;
  });
  void idbWrite(db, (store) => {
    // 그사이 새로 저장된 값(메모리에 있음)은 옛 값으로 덮지 않는다.
    for (const [k, v] of entries) if (!mem.has(k)) store.put(v, k);
  }).then((ok) => {
    if (!ok) return;
    for (const [k] of entries) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
  });
}

/** 메모리에 있으면 바로 돌려준다(필기 dataURL 또는 "" = 없음). 모르면 undefined. */
export function peekInk(key: string): string | undefined {
  return mem.get(key);
}

/** 저장된 필기를 찾는다(메모리 → IndexedDB → 옛 localStorage). 없으면 null. */
export async function loadInk(key: string): Promise<string | null> {
  const cached = mem.get(key);
  if (cached !== undefined) return cached || null;
  const db = await openDb();
  let v = db ? await idbGet(db, key) : null;
  if (!isInk(v)) {
    try {
      const legacy = localStorage.getItem(key);
      v = isInk(legacy) ? legacy : null;
    } catch {
      v = null;
    }
  }
  // 기다리는 사이 새로 저장됐으면 그쪽이 맞다.
  const now = mem.get(key);
  if (now !== undefined) return now || null;
  mem.set(key, v ?? "");
  return v;
}

/** 필기를 저장한다. 메모리에는 바로, IndexedDB 에는 뒤에서. */
export function saveInk(key: string, dataUrl: string) {
  mem.set(key, dataUrl);
  void openDb().then(async (db) => {
    const ok = db ? await idbWrite(db, (s) => s.put(dataUrl, key)) : false;
    if (mem.get(key) !== dataUrl) return; // 그새 더 새 값이 들어왔다.
    try {
      if (ok) localStorage.removeItem(key);
      else localStorage.setItem(key, dataUrl); // IndexedDB 를 못 쓰는 환경만 예전처럼.
    } catch { /* ignore */ }
  });
}

export function deleteInk(key: string) {
  mem.set(key, "");
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  void openDb().then((db) => { if (db) void idbWrite(db, (s) => s.delete(key)); });
}
