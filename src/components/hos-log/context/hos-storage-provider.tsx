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
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
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
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
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

async function saveHosLog(
  record: HosLogRecord,
  expectedUpdatedAt: string | null,
): Promise<HosLogRecord> {
  const database = await openDatabase();

  return new Promise<HosLogRecord>((resolve, reject) => {
    const transaction = database.transaction(LOG_STORE, "readwrite");
    const store = transaction.objectStore(LOG_STORE);
    const request = store.get(record.date);
    let saved: HosLogRecord | undefined;
    let conflict = false;
    request.onsuccess = () => {
      const current = request.result as HosLogRecord | undefined;
      if ((current?.updatedAt ?? null) !== expectedUpdatedAt) {
        conflict = true;
        transaction.abort();
        return;
      }
      const previousTime = current ? Date.parse(current.updatedAt) : 0;
      const timestamp = Math.max(
        Date.now(),
        Number.isFinite(previousTime) ? previousTime + 1 : 0,
      );
      saved = { ...record, updatedAt: new Date(timestamp).toISOString() };
      store.put(saved);
    };
    transaction.oncomplete = () => resolve(saved!);
    transaction.onerror = () =>
      reject(
        (conflict
          ? new Error(
              `The log for ${record.date} changed in another session. Reload it before saving.`,
            )
          : transaction.error) ??
          new Error(`Failed to save the HOS log for ${record.date}.`),
      );
    transaction.onabort = () =>
      reject(
        (conflict
          ? new Error(
              `The log for ${record.date} changed in another session. Reload it before saving.`,
            )
          : transaction.error) ??
          new Error(`Failed to save the HOS log for ${record.date}.`),
      );
  });
}

export interface HosStorageContextValue {
  /** Saved daily logs, newest first. */
  savedLogs: Signal<HosLogRecord[]>;
  /** True once logs have been successfully loaded from IndexedDB. */
  storageReady: Signal<boolean>;
  /** Re-reads IndexedDB, normalizes records and updates `savedLogs`. */
  refreshSavedLogs: QRL<() => Promise<HosLogRecord[]>>;
  /** Reads one day straight from IndexedDB (null when not saved). */
  getLog: QRL<(date: string) => Promise<HosLogRecord | null>>;
  /** Writes one day to IndexedDB and updates `savedLogs`. */
  saveLog: QRL<
    (
      record: HosLogRecord,
      expectedUpdatedAt: string | null,
    ) => Promise<HosLogRecord>
  >;
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
  return logText === record.logText ? record : { ...record, logText };
}

async function loadNormalizedRecords(): Promise<HosLogRecord[]> {
  const now = new Date();
  const stored = await listHosLogs();
  return stored.map((record) => normalizeRecord(record, now));
}

export const HosStorageProvider = component$(() => {
  const savedLogs = useSignal<HosLogRecord[]>([]);
  const storageReady = useSignal(false);

  const refreshSavedLogs = $(async () => {
    const records = await loadNormalizedRecords();
    savedLogs.value = records;
    storageReady.value = true;
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

  const saveLog = $(
    async (record: HosLogRecord, expectedUpdatedAt: string | null) => {
      const saved = await saveHosLog(record, expectedUpdatedAt);
      savedLogs.value = [
        saved,
        ...savedLogs.value.filter((item) => item.date !== record.date),
      ].sort((a, b) => b.date.localeCompare(a.date));
      return saved;
    },
  );

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
        storageReady.value = true;
      } catch (error) {
        console.error("Failed to initialize storage:", error);
      }
    },
    { strategy: "document-ready" },
  );

  return <Slot />;
});
