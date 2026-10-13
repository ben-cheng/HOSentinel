export type HosLogRecord = {
  date: string;
  logText: string;
  updatedAt: string;
};

const DATABASE_NAME = "hosentinel";
const DATABASE_VERSION = 1;
const LOG_STORE = "daily-logs";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(LOG_STORE)) {
          database.createObjectStore(LOG_STORE, { keyPath: "date" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to open HOS log storage."));
      request.onblocked = () =>
        reject(new Error("HOS log storage upgrade is blocked by another tab."));
    });
  }

  return databasePromise;
}

export async function getHosLog(date: string): Promise<HosLogRecord | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readonly");
    const request = transaction.objectStore(LOG_STORE).get(date);

    request.onsuccess = () =>
      resolve((request.result as HosLogRecord | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to load the HOS log for ${date}.`));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error(`Failed to load the HOS log for ${date}.`));
  });
}

export async function listHosLogs(): Promise<HosLogRecord[]> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readonly");
    const request = transaction.objectStore(LOG_STORE).getAll();

    request.onsuccess = () =>
      resolve(
        (request.result as HosLogRecord[]).sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to list saved HOS logs."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Failed to list saved HOS logs."));
  });
}

export async function saveHosLog(
  record: HosLogRecord,
): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readwrite");
    transaction.objectStore(LOG_STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error(`Failed to save the HOS log for ${record.date}.`));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error(`Failed to save the HOS log for ${record.date}.`));
  });
}
