export interface HistoryEntry {
  schemaVersion?: number;
  id: string;
  name: string;
  inputFormat: string;
  outputFormat: string;
  inputSize: number;
  outputSize: number;
  createdAt: number;
  settings: Record<string, string | number | boolean>;
}

const DATABASE = "convertbox-history";
const STORE = "conversions";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const database = await openDatabase();
  try {
    const entries = await requestResult(database.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<unknown[]>);
    return entries.filter((item): item is HistoryEntry => typeof item === "object" && item !== null && typeof (item as HistoryEntry).id === "string" && typeof (item as HistoryEntry).name === "string" && typeof (item as HistoryEntry).createdAt === "number" && typeof (item as HistoryEntry).inputFormat === "string" && typeof (item as HistoryEntry).outputFormat === "string")
      .map(item => ({ ...item, schemaVersion: 2, settings: item.settings && typeof item.settings === "object" ? item.settings : {}, inputSize: Number.isFinite(item.inputSize) ? item.inputSize : 0, outputSize: Number.isFinite(item.outputSize) ? item.outputSize : 0 }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    database.close();
  }
}

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(STORE, "readwrite").objectStore(STORE).put({ ...entry, schemaVersion: 2 }));
  } finally {
    database.close();
  }
  const entries = await listHistory();
  if (entries.length > 200) {
    const db = await openDatabase();
    try {
      const transaction = db.transaction(STORE, "readwrite");
      for (const old of entries.slice(200)) transaction.objectStore(STORE).delete(old.id);
      await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    } finally {
      db.close();
    }
  }
}

export async function clearHistory(): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(STORE, "readwrite").objectStore(STORE).clear());
  } finally {
    database.close();
  }
}
