import { useSignal, useTask$, $ } from "@qwik.dev/core";
import { listHosLogs, saveHosLog } from "./hos-log-storage";
import type { HosLogRecord } from "./hos-log-storage";
import {
  formatDailyLog,
  parseLogs,
  getFinalStatus,
  finalizeCompletedLogEntries,
} from "./hos-log-normalizer";

function normalizeRecord(record: HosLogRecord, now: Date): HosLogRecord {
  const parsed = parseLogs(record.logText, {
    date: record.date,
    now,
    completedAt: record.completedAt,
    expectedDate: record.date,
  });
  const entries = record.completedAt
    ? finalizeCompletedLogEntries(
        parsed.canonicalEntries,
        record.completedAt,
      )
    : parsed.canonicalEntries;
  const logText = formatDailyLog(parsed.date, entries).replace(/\s/g, "");
  return logText === record.logText
    ? record
    : { ...record, logText, updatedAt: now.toISOString() };
}

export function useStorageLogs() {
  const savedLogs = useSignal<HosLogRecord[]>([]);
  const storageReady = useSignal(false);

  // Initialize storage on mount
  useTask$(async () => {
    try {
      const records = await listHosLogs();
      const now = new Date();
      const normalized = await Promise.all(
        records.map(async (record) => {
          const norm = normalizeRecord(record, now);
          if (norm !== record) await saveHosLog(norm);
          return norm;
        }),
      );
      savedLogs.value = normalized;
      storageReady.value = true;
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      storageReady.value = true;
    }
  });

  // Refresh saved logs
  const refreshSavedLogs = $(async () => {
    const now = new Date();
    const storedRecords = await listHosLogs();
    const records = await Promise.all(
      storedRecords.map(async (record) => {
        const normalized = normalizeRecord(record, now);
        if (normalized !== record) await saveHosLog(normalized);
        return normalized;
      }),
    );
    savedLogs.value = records;
    return records;
  });

  // Get starting status for a date (carry forward from previous day)
  const getStartingStatus = $(
    (date: string) => {
      const previousRecord = savedLogs.value.find(
        (record) => record.date < date,
      );
      if (!previousRecord) return "O";

      return getFinalStatus(
        parseLogs(previousRecord.logText, {
          date: previousRecord.date,
          completedAt: previousRecord.completedAt,
        }).value,
      );
    },
  );

  return {
    savedLogs,
    storageReady,
    refreshSavedLogs,
    getStartingStatus,
  };
}
