import { useSignal, useComputed$, useTask$, $ } from "@qwik.dev/core";
import type { DutyEntry, StatusDuration, StatusKey } from "./hours-of-service";
import {
  createEmptyStatusDuration,
} from "./hours-of-service";
import {
  formatDailyLog,
  getActiveDutyEntry,
  parseLogs,
  endsAtEndOfDay,
  finalizeCompletedLogEntries,
  reopenCompletedLogEntries,
} from "./hos-log-normalizer";
import type { ParseResult } from "./hos-log-normalizer";
import { updateLogForStatus } from "./hos-log-status-updater";
import { saveHosLog } from "./hos-log-storage";
import type { HosLogRecord } from "./hos-log-storage";

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export interface TodayLogState {
  date: string;
  input: string;
  result: DutyEntry[];
  calculatedDuration: StatusDuration;
  error: string | null;
  storageError: string | null;
  storageMessage: string | null;
  loadedRecord: HosLogRecord | null;
  isDayComplete: boolean;
  currentMinute: number;
  currentDutyEntry: DutyEntry | undefined;
  isSaving: boolean;
  isLoadingDay: boolean;
}

export function useTodayLog() {
  const date = useSignal("");
  const input = useSignal("O");
  const result = useSignal<DutyEntry[]>([]);
  const calculatedDuration = useSignal<StatusDuration>(
    createEmptyStatusDuration(),
  );
  const error = useSignal<string | null>(null);
  const storageError = useSignal<string | null>(null);
  const storageMessage = useSignal<string | null>(null);
  const loadedRecord = useSignal<HosLogRecord | null>(null);
  const currentMinute = useSignal(getMinuteOfDay(new Date()));
  const isSaving = useSignal(false);
  const isLoadingDay = useSignal(false);
  const pendingStatusEntries = useSignal<StatusKey[]>([]);
  const isProcessingStatusEntries = useSignal(false);

  // Parse and compute state
  useTask$(({ track }) => {
    const logDate = track(() => date.value);
    const logText = track(() => input.value);
    const completedAt = track(() => loadedRecord.value?.completedAt ?? null);
    try {
      const parsed = parseLogs(logText, {
        date: logDate,
        now: new Date(),
        completedAt,
        expectedDate: logDate,
      });
      result.value = parsed.value;
      calculatedDuration.value = parsed.duration;
      error.value = parsed.error;
    } catch (cause) {
      result.value = [];
      calculatedDuration.value = createEmptyStatusDuration();
      error.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
    }
  });

  // Current duty entry (computed from parsed results)
  const currentDutyEntry = useComputed$(() => {
    return getActiveDutyEntry(result.value, currentMinute.value);
  });

  // Is day complete (derived from loadedRecord)
  const isDayComplete = useComputed$(() => {
    return Boolean(loadedRecord.value?.completedAt);
  });

  // Clear messages
  const clearMessages = $(() => {
    storageError.value = null;
    storageMessage.value = null;
  });

  // Show success message
  const showSaveSuccess = $(() => {
    storageError.value = null;
    storageMessage.value = "Log saved on this device.";
  });

  // Show error message
  const showSaveError = $(async (message: string) => {
    storageError.value = message;
    storageMessage.value = null;
  });

  // Persist log to storage
  const persistLog = $(
    async (
      dateStr: string,
      logText: string,
      completedAt: string | null = null,
      previousCompletedAt: string | null = null,
      completeAtEndOfDay = false,
    ) => {
      if (isSaving.value) return false;

      clearMessages();
      if (dateStr !== getLocalDateKey(new Date())) {
        await showSaveError("Past-day logs are read-only.");
        return false;
      }
      isSaving.value = true;
      try {
        let parsed: ParseResult;
        try {
          parsed = parseLogs(logText, {
            date: dateStr,
            now: new Date(),
            completedAt,
            expectedDate: dateStr,
          });
          error.value = null;
        } catch (cause) {
          error.value =
            cause instanceof Error
              ? cause.message
              : "Failed to parse this day's log.";
          return false;
        }

        const savedCompletedAt =
          completeAtEndOfDay && endsAtEndOfDay(parsed.canonicalEntries)
            ? (completedAt ?? new Date().toISOString())
            : completedAt;
        const entries = savedCompletedAt
          ? finalizeCompletedLogEntries(
              parsed.canonicalEntries,
              savedCompletedAt,
            )
          : previousCompletedAt
            ? reopenCompletedLogEntries(
                parsed.canonicalEntries,
                previousCompletedAt,
              )
            : parsed.canonicalEntries;
        const displayLog = formatDailyLog(parsed.date, entries);
        const record: HosLogRecord = {
          date: dateStr,
          logText: displayLog.replace(/\s/g, ""),
          updatedAt: new Date().toISOString(),
          completedAt: savedCompletedAt,
        };
        await saveHosLog(record);
        if (date.value === dateStr) {
          input.value = displayLog;
          loadedRecord.value = { ...record, logText: displayLog };
          showSaveSuccess();
        }
        return true;
      } catch (cause) {
        await showSaveError(
          cause instanceof Error
            ? cause.message
            : "Failed to save this day's log.",
        );
        return false;
      } finally {
        isSaving.value = false;
      }
    },
  );

  // Add status entry to queue
  const queueStatusEntry = $(async (status: StatusKey) => {
    pendingStatusEntries.value = [...pendingStatusEntries.value, status];
  });

  // Process pending status entries
  const processPendingStatusEntries = $(async () => {
    if (isProcessingStatusEntries.value) return;
    isProcessingStatusEntries.value = true;
    try {
      while (pendingStatusEntries.value.length > 0) {
        const status = pendingStatusEntries.value[0];

        if (isLoadingDay.value || isSaving.value) break;

        pendingStatusEntries.value = pendingStatusEntries.value.slice(1);

        const updatedLog = updateLogForStatus(input.value, status, new Date());
        if (updatedLog === input.value) continue;
        input.value = updatedLog;

        const completedAt =
          loadedRecord.value?.date === date.value
            ? (loadedRecord.value.completedAt ?? null)
            : null;
        await persistLog(date.value, updatedLog, completedAt, completedAt);
      }
    } finally {
      isProcessingStatusEntries.value = false;
    }
  });

  return {
    // State signals
    date,
    input,
    result,
    calculatedDuration,
    error,
    storageError,
    storageMessage,
    loadedRecord,
    currentMinute,
    isSaving,
    isLoadingDay,
    pendingStatusEntries,
    isProcessingStatusEntries,
    // Computed
    currentDutyEntry,
    isDayComplete,
    // Actions
    clearMessages,
    showSaveSuccess,
    showSaveError,
    persistLog,
    queueStatusEntry,
    processPendingStatusEntries,
  };
}
