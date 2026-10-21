import { useSignal, useTask$, $, type Signal } from "@qwik.dev/core";
import type { StatusDuration } from "./hours-of-service";
import { createEmptyStatusDuration } from "./hours-of-service";
import {
  formatDailyLog,
  parseLogs,
  finalizeCompletedLogEntries,
  getFinalStatus,
} from "./hos-log-normalizer";
import type { ParseResult } from "./hos-log-normalizer";
import { saveHosLog } from "./hos-log-storage";
import type { HosLogRecord } from "./hos-log-storage";
import {
  getLocalDateKey,
} from "./date-utils";

function getStartingStatus(date: string, records: HosLogRecord[]) {
  const previousRecord = records.find((record) => record.date < date);
  if (!previousRecord) return "O";

  return getFinalStatus(
    parseLogs(previousRecord.logText, {
      date: previousRecord.date,
      completedAt: previousRecord.completedAt,
    }).value,
  );
}

export interface HistoryState {
  open: boolean;
  date: string;
  input: string;
  duration: StatusDuration;
  error: string | null;
  storageError: string | null;
  isLoading: boolean;
  isSaving: boolean;
}

export function useHistoryLog(savedLogs: Signal<HosLogRecord[]>) {
  const open = useSignal(false);
  const historyDate = useSignal("");
  const historyInput = useSignal("");
  const historyDuration = useSignal<StatusDuration>(
    createEmptyStatusDuration(),
  );
  const historyError = useSignal<string | null>(null);
  const historyStorageError = useSignal<string | null>(null);
  const isHistoryLoading = useSignal(false);
  const isHistorySaving = useSignal(false);
  const historyRequestId = useSignal(0);
  const cachedRecords = useSignal<HosLogRecord[]>([]);

  // Cache the records for use in $ callbacks
  useTask$(({ track }) => {
    cachedRecords.value = track(() => savedLogs.value);
  });

  // Parse history input
  useTask$(({ track }) => {
    const dateVal = track(() => historyDate.value);
    const inputVal = track(() => historyInput.value);
    const records = track(() => savedLogs.value);
    const completedAt = records.find(
      (record) => record.date === dateVal,
    )?.completedAt;
    try {
      historyDuration.value = parseLogs(inputVal, {
        date: dateVal,
        now: new Date(),
        completedAt,
        expectedDate: dateVal,
      }).duration;
      historyError.value = null;
    } catch (cause) {
      historyError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
    }
  });

  const openHistoricalDay = $(async (date: string) => {
    if (!date || date >= getLocalDateKey(new Date())) return;
    if (open.value && historyDate.value === date) return;

    const requestId = ++historyRequestId.value;
    open.value = true;
    historyDate.value = date;
    historyError.value = null;
    historyStorageError.value = null;
    historyInput.value = "O";
    isHistoryLoading.value = true;

    try {
      const records = cachedRecords.value;
      if (requestId !== historyRequestId.value) return;
      const record =
        records.find((savedRecord) => savedRecord.date === date) ?? null;
      const carryStatus = record ? "O" : getStartingStatus(date, records);
      const parsedRecord = record
        ? parseLogs(record.logText, {
            date,
            now: new Date(),
            completedAt: record.completedAt,
            expectedDate: date,
          })
        : parseLogs(carryStatus, { date, now: new Date(), expectedDate: date });
      const displayLog = formatDailyLog(date, parsedRecord.canonicalEntries);
      historyInput.value = displayLog;
      historyDuration.value = parsedRecord.duration;
    } catch (cause) {
      if (requestId === historyRequestId.value) {
        historyStorageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to load this day's log.";
      }
    } finally {
      if (requestId === historyRequestId.value) {
        isHistoryLoading.value = false;
      }
    }
  });

  const discardChanges = $(() => {
    historyRequestId.value++;
    open.value = false;
    historyError.value = null;
    historyStorageError.value = null;
    historyInput.value = "";
  });

  const saveHistoricalDay = $(async (logText: string) => {
    if (!historyDate.value || isHistorySaving.value) return false;

    historyError.value = null;
    historyStorageError.value = null;
    const records = cachedRecords.value;
    const existing = records.find((record) => record.date === historyDate.value);

    let parsed: ParseResult;
    try {
      parsed = parseLogs(logText, {
        date: historyDate.value,
        now: new Date(),
        completedAt: existing?.completedAt,
        expectedDate: historyDate.value,
      });
    } catch (cause) {
      historyError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
      return false;
    }

    isHistorySaving.value = true;
    try {
      const entries = existing?.completedAt
        ? finalizeCompletedLogEntries(
            parsed.canonicalEntries,
            existing.completedAt,
          )
        : parsed.canonicalEntries;
      const displayLog = formatDailyLog(parsed.date, entries);
      await saveHosLog({
        date: historyDate.value,
        logText: displayLog.replace(/\s/g, ""),
        updatedAt: new Date().toISOString(),
        completedAt: existing?.completedAt ?? null,
      });
      historyInput.value = displayLog;
      historyDuration.value = parseLogs(displayLog, {
        date: historyDate.value,
        now: new Date(),
        completedAt: existing?.completedAt,
        expectedDate: historyDate.value,
      }).duration;
      return true;
    } catch (cause) {
      historyStorageError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to save this day's log.";
      return false;
    } finally {
      isHistorySaving.value = false;
    }
  });

  return {
    // State
    open,
    historyDate,
    historyInput,
    historyDuration,
    historyError,
    historyStorageError,
    isHistoryLoading,
    isHistorySaving,
    // Actions
    openHistoricalDay,
    discardChanges,
    saveHistoricalDay,
  };
}
