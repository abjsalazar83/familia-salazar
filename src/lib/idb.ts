// Pequeno armazenamento chave→valor em IndexedDB (dados em cache e fila de escrita).
let dbp: Promise<IDBDatabase> | null = null;
function db() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('familia-salazar', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => res(r.result as T); r.onerror = () => rej(r.error); });
}
export async function idbSet(key: string, val: unknown) {
  const d = await db();
  return new Promise<void>((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
