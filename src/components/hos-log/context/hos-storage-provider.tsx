import {
  $,
  component$,
  createContextId,
  Slot,
  useContextProvider,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import {
  finalizeCompletedLogEntries,
  formatDailyLog,
  getFinalStatus,
  parseLogs,
} from "../hos-log-normalizer";

export type HosLogRecord = {
  date: string;
  logText: string;
  updatedAt: string;
  completedAt?: string | null;
};

const DATABASE_NAME = "hosentinel";
const DATABASE_VERSION = 1;
const LOG_STORE = "daily-logs";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB is not available in this browser."),
    );
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

async function getHosLog(date: string): Promise<HosLogRecord | null> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readonly");
    const request = transaction.objectStore(LOG_STORE).get(date);

    request.onsuccess = () =>
      resolve((request.result as HosLogRecord | undefined) ?? null);
    request.onerror = () =>
      reject(
        request.error ?? new Error(`Failed to load the HOS log for ${date}.`),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error(`Failed to load the HOS log for ${date}.`),
      );
  });
}

async function listHosLogs(): Promise<HosLogRecord[]> {
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

async function saveHosLog(record: HosLogRecord): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readwrite");
    transaction.objectStore(LOG_STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error(`Failed to save the HOS log for ${record.date}.`),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error(`Failed to save the HOS log for ${record.date}.`),
      );
  });
}

export interface HosStorageContextValue {
  /** Saved daily logs, newest first. */
  savedLogs: Signal<HosLogRecord[]>;
  /** True once the first load from IndexedDB has finished (or failed). */
  storageReady: Signal<boolean>;
  /** Re-reads IndexedDB, normalizes records and updates `savedLogs`. */
  refreshSavedLogs: QRL<() => Promise<HosLogRecord[]>>;
  /** Reads one day straight from IndexedDB (null when not saved). */
  getLog: QRL<(date: string) => Promise<HosLogRecord | null>>;
  /** Writes one day to IndexedDB and updates `savedLogs`. */
  saveLog: QRL<(record: HosLogRecord) => Promise<void>>;
  /** Final status of the latest saved day before `date` ("O" when none). */
  getStartingStatus: QRL<(date: string) => string>;
}

export const HosStorageContext = createContextId<HosStorageContextValue>(
  "hos-storage-context",
);

function normalizeRecord(record: HosLogRecord, now: Date): HosLogRecord {
  const parsed = parseLogs(record.logText, {
    date: record.date,
    now,
    completedAt: record.completedAt,
    expectedDate: record.date,
  });
  const entries = record.completedAt
    ? finalizeCompletedLogEntries(parsed.canonicalEntries, record.completedAt)
    : parsed.canonicalEntries;
  const logText = formatDailyLog(parsed.date, entries).replace(/\s/g, "");
  return logText === record.logText
    ? record
    : { ...record, logText, updatedAt: now.toISOString() };
}

async function loadNormalizedRecords(): Promise<HosLogRecord[]> {
  const now = new Date();
  const stored = await listHosLogs();
  return Promise.all(
    stored.map(async (record) => {
      const normalized = normalizeRecord(record, now);
      if (normalized !== record) await saveHosLog(normalized);
      return normalized;
    }),
  );
}

export const HosStorageProvider = component$(() => {
  const savedLogs = useSignal<HosLogRecord[]>([]);
  const storageReady = useSignal(false);

  const refreshSavedLogs = $(async () => {
    const records = await loadNormalizedRecords();
    savedLogs.value = records;
    return records;
  });

  const getStartingStatus = $((date: string) => {
    const previousRecord = savedLogs.value.find((record) => record.date < date);
    if (!previousRecord) return "O";
    return getFinalStatus(
      parseLogs(previousRecord.logText, {
        date: previousRecord.date,
        completedAt: previousRecord.completedAt,
      }).value,
    );
  });

  const getLog = $((date: string) => getHosLog(date));

  const saveLog = $(async (record: HosLogRecord) => {
    await saveHosLog(record);
    savedLogs.value = [
      record,
      ...savedLogs.value.filter((item) => item.date !== record.date),
    ].sort((a, b) => b.date.localeCompare(a.date));
  });

  useContextProvider(HosStorageContext, {
    savedLogs,
    storageReady,
    refreshSavedLogs,
    getLog,
    saveLog,
    getStartingStatus,
  });

  // IndexedDB only exists in the browser.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async () => {
      try {
        savedLogs.value = await loadNormalizedRecords();
      } catch (error) {
        console.error("Failed to initialize storage:", error);
      } finally {
        storageReady.value = true;
      }
    },
    { strategy: "document-ready" },
  );

  return <Slot />;
});
