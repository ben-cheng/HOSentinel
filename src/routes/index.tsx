import {
  component$,
  useSignal,
  $,
  useTask$,
  useOnWindow,
  isServer,
  useContext,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { HosContext } from "~/components/hos-log/hours-of-service";
import type {
  DailyLog,
  LogEntry as DailyLogEntry,
} from "~/components/hos-log/hours-of-service";
import type {
  DutyEntry,
  StatusDuration,
  StatusKey,
} from "~/components/hos-log/hours-of-service";
import {
  createEmptyStatusDuration,
  isStatusKey,
  STATUS_MAP,
} from "~/components/hos-log/hours-of-service";
import {
  endsAtEndOfDay,
  finalizeCompletedLogEntries,
  formatDailyLog,
  getFinalStatus,
  getActiveDutyEntry,
  parseLogs,
  reopenCompletedLogEntries,
} from "~/components/hos-log/hos-log-normalizer";
import type { ParseResult } from "~/components/hos-log/hos-log-normalizer";
import { updateLogForStatus } from "~/components/hos-log/hos-log-status-updater";
import {
  getHosLog,
  listHosLogs,
  saveHosLog,
} from "~/components/hos-log/hos-log-storage";
import type { HosLogRecord } from "~/components/hos-log/hos-log-storage";
import { HistoryDrawer } from "~/components/hos-log/history-drawer";
import { TodayLogPanel } from "~/components/hos-log/today-log-panel";

function toDailyLog(
  date: string,
  canonicalEntries: string[],
  completedAt: string | null,
): DailyLog {
  const entries: DailyLogEntry[] = canonicalEntries.map((entry) => {
    const match = entry.match(/^([OSDN])(\d{4})?$/);
    if (!match) throw new Error(`Invalid canonical log entry: "${entry}"`);

    const statusKey = match[1];
    if (!isStatusKey(statusKey)) {
      throw new Error(`Invalid duty status in log entry: "${entry}"`);
    }
    const time = match[2];
    return {
      status: STATUS_MAP[statusKey],
      endMinute: time
        ? Number(time.slice(0, 2)) * 60 + Number(time.slice(2))
        : null,
    };
  });

  return { date, entries, completedAt };
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getPreviousLocalDateKey(date: Date | string): string {
  const previousDate =
    date instanceof Date ? new Date(date) : new Date(`${date}T00:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  return getLocalDateKey(previousDate);
}

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

export default component$(() => {
  const dailyLog = useContext(HosContext);
  const input = useSignal("O");
  const selectedDate = useSignal("");
  const result = useSignal<DutyEntry[]>([]);
  const calculatedDuration = useSignal<StatusDuration>(
    createEmptyStatusDuration(),
  );
  const todayBreakdownDuration = useSignal<StatusDuration>(
    createEmptyStatusDuration(),
  );
  const error = useSignal<string | null>(null);
  const storageError = useSignal<string | null>(null);
  const storageMessage = useSignal<string | null>(null);
  const savedLogs = useSignal<HosLogRecord[]>([]);
  const loadedRecord = useSignal<HosLogRecord | null>(null);
  const historyOpen = useSignal(false);
  const historyDate = useSignal("");
  const historyInput = useSignal("");
  const historyDuration = useSignal<StatusDuration>(
    createEmptyStatusDuration(),
  );
  const historyError = useSignal<string | null>(null);
  const historyStorageError = useSignal<string | null>(null);
  const isHistoryLoading = useSignal(false);
  const isHistorySaving = useSignal(false);
  const storageReady = useSignal(false);
  const isLoadingDay = useSignal(false);
  const isSaving = useSignal(false);
  const historyRequestId = useSignal(0);
  const currentDate = useSignal(getLocalDateKey(new Date()));
  const currentMinute = useSignal(getMinuteOfDay(new Date()));
  const currentDutyEntry = useSignal<DutyEntry>();
  const pendingStatusEntries = useSignal<StatusKey[]>([]);
  const isProcessingStatusEntries = useSignal(false);

  useTask$(({ track }) => {
    const minute = track(() => currentMinute.value);
    const date = track(() => selectedDate.value);
    const logText = track(() => input.value);
    const completedAt = track(() => loadedRecord.value?.completedAt ?? null);
    try {
      const parsed = parseLogs(logText, {
        date,
        now: new Date(),
        completedAt,
        expectedDate: date,
      });
      if (date) {
        dailyLog.value = toDailyLog(
          parsed.date,
          parsed.canonicalEntries,
          completedAt,
        );
      }
      result.value = parsed.value;
      calculatedDuration.value = parsed.duration;
      error.value = parsed.error;
      currentDutyEntry.value = getActiveDutyEntry(parsed.value, minute);
      todayBreakdownDuration.value = parsed.duration;
    } catch (cause) {
      result.value = [];
      calculatedDuration.value = createEmptyStatusDuration();
      todayBreakdownDuration.value = createEmptyStatusDuration();
      currentDutyEntry.value = undefined;
      error.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
    }
  });

  useTask$(({ cleanup }) => {
    if (isServer) return;

    const updateCurrentMinute = () => {
      const now = new Date();
      currentDate.value = getLocalDateKey(now);
      currentMinute.value = getMinuteOfDay(now);
    };
    updateCurrentMinute();
    const interval = setInterval(updateCurrentMinute, 15_000);
    cleanup(() => clearInterval(interval));
  });

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

  const persistLog = $(
    async (
      date: string,
      logText: string,
      completedAt: string | null = null,
      previousCompletedAt: string | null = null,
      completeAtEndOfDay = false,
    ) => {
      if (isSaving.value) return false;

      storageError.value = null;
      storageMessage.value = null;
      if (date !== getLocalDateKey(new Date())) {
        storageError.value = "Past-day logs are read-only.";
        return false;
      }
      isSaving.value = true;
      try {
        let parsed: ParseResult;
        try {
          parsed = parseLogs(logText, {
            date,
            now: new Date(),
            completedAt,
            expectedDate: date,
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
          date,
          logText: displayLog.replace(/\s/g, ""),
          updatedAt: new Date().toISOString(),
          completedAt: savedCompletedAt,
        };
        await saveHosLog(record);
        if (selectedDate.value === date) {
          input.value = displayLog;
          loadedRecord.value = { ...record, logText: displayLog };
          storageMessage.value = "Log saved on this device.";
        }
        await refreshSavedLogs();
        return true;
      } catch (cause) {
        storageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to save this day's log.";
        return false;
      } finally {
        isSaving.value = false;
      }
    },
  );

  const openHistoricalDay = $(async (date: string) => {
    if (!date || date >= getLocalDateKey(new Date())) return;
    if (historyOpen.value && historyDate.value === date) return;

    const requestId = ++historyRequestId.value;
    historyOpen.value = true;
    historyDate.value = date;
    historyError.value = null;
    historyStorageError.value = null;
    historyInput.value = "O";
    isHistoryLoading.value = true;

    try {
      const records = await refreshSavedLogs();
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

  const discardHistoricalChanges = $(() => {
    historyRequestId.value++;
    historyOpen.value = false;
    historyError.value = null;
    historyStorageError.value = null;
    historyInput.value = "";
  });

  const saveHistoricalDay = $(async (logText: string) => {
    if (!historyDate.value || isHistorySaving.value) return false;

    historyError.value = null;
    historyStorageError.value = null;
    const existing = savedLogs.value.find(
      (record) => record.date === historyDate.value,
    );

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
      await refreshSavedLogs();
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

  const saveEditedLog = $(async (logText: string) => {
    if (!selectedDate.value) return false;
    const previousCompletedAt =
      loadedRecord.value?.date === selectedDate.value
        ? (loadedRecord.value.completedAt ?? null)
        : null;
    const isToday = selectedDate.value === getLocalDateKey(new Date());
    return persistLog(
      selectedDate.value,
      logText,
      previousCompletedAt,
      previousCompletedAt,
      isToday,
    );
  });

  const processPendingStatusEntries = $(async () => {
    if (isProcessingStatusEntries.value) return;
    isProcessingStatusEntries.value = true;
    try {
      while (pendingStatusEntries.value.length > 0) {
        const status = pendingStatusEntries.value[0];

        if (historyOpen.value || loadedRecord.value?.completedAt) {
          pendingStatusEntries.value = pendingStatusEntries.value.slice(1);
          continue;
        }
        if (isLoadingDay.value || isSaving.value) break;

        pendingStatusEntries.value = pendingStatusEntries.value.slice(1);

        const today = getLocalDateKey(new Date());
        if (selectedDate.value !== today) {
          await rollOverToToday();
          if (storageError.value || selectedDate.value !== today) continue;
        }

        const updatedLog = updateLogForStatus(input.value, status, new Date());
        if (updatedLog === input.value) continue;
        input.value = updatedLog;

        const completedAt =
          loadedRecord.value?.date === selectedDate.value
            ? (loadedRecord.value.completedAt ?? null)
            : null;
        await persistLog(
          selectedDate.value,
          updatedLog,
          completedAt,
          completedAt,
        );
      }
    } finally {
      isProcessingStatusEntries.value = false;
    }
  });

  const openHistory = $(() => {
    const yesterday = getPreviousLocalDateKey(getLocalDateKey(new Date()));
    const mostRecentPastLog = savedLogs.value.find(
      (record) => record.date < getLocalDateKey(new Date()),
    );
    openHistoricalDay(mostRecentPastLog?.date ?? yesterday);
  });

  const rollOverToToday = $(async () => {
    const today = getLocalDateKey(new Date());
    if (selectedDate.value === today || isLoadingDay.value) return;

    isLoadingDay.value = true;
    storageError.value = null;
    try {
      const records = await refreshSavedLogs();
      const record = await getHosLog(today);
      const startingStatus = record ? "O" : getStartingStatus(today, records);
      const parsedRecord = record
        ? parseLogs(record.logText, {
            date: today,
            now: new Date(),
            completedAt: record.completedAt,
            expectedDate: today,
          })
        : parseLogs(startingStatus, {
            date: today,
            now: new Date(),
            expectedDate: today,
          });
      const displayLog = formatDailyLog(today, parsedRecord.canonicalEntries);
      selectedDate.value = today;
      loadedRecord.value = record ? { ...record, logText: displayLog } : null;
      input.value = displayLog;
      if (!record) {
        await persistLog(today, startingStatus);
      }
    } catch (cause) {
      storageError.value =
        cause instanceof Error ? cause.message : "Failed to load today's log.";
    } finally {
      isLoadingDay.value = false;
    }
  });

  useOnWindow(
    "load",
    $(async () => {
      const today = getLocalDateKey(new Date());
      selectedDate.value = today;
      try {
        const records = await refreshSavedLogs();
        const record = await getHosLog(today);
        const carryStatus = record ? "O" : getStartingStatus(today, records);
        const parsedRecord = record
          ? parseLogs(record.logText, {
              date: today,
              now: new Date(),
              completedAt: record.completedAt,
              expectedDate: today,
            })
          : parseLogs(carryStatus, {
              date: today,
              now: new Date(),
              expectedDate: today,
            });
        const displayLog = formatDailyLog(today, parsedRecord.canonicalEntries);
        loadedRecord.value = record ? { ...record, logText: displayLog } : null;
        input.value = displayLog;
        if (!record) {
          await persistLog(today, carryStatus);
        }
      } catch (cause) {
        storageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to open local HOS log storage.";
      } finally {
        storageReady.value = true;
      }
    }),
  );

  useTask$(({ track }) => {
    const today = track(() => currentDate.value);
    const selected = track(() => selectedDate.value);
    const ready = track(() => storageReady.value);
    if (!isServer && ready && selected && selected !== today) {
      rollOverToToday();
    }
  });

  useTask$(({ track }) => {
    const saving = track(() => isSaving.value);
    const loading = track(() => isLoadingDay.value);
    const queueLength = track(() => pendingStatusEntries.value.length);
    const processing = track(() => isProcessingStatusEntries.value);
    if (!saving && !loading && !processing && queueLength > 0) {
      processPendingStatusEntries();
    }
  });

  const addStatusEntry = $(async (status: "O" | "D" | "N") => {
    if (historyOpen.value || loadedRecord.value?.completedAt) {
      return;
    }
    pendingStatusEntries.value = [...pendingStatusEntries.value, status];
    await processPendingStatusEntries();
  });

  useTask$(({ track }) => {
    track(() => historyInput.value);
    const date = track(() => historyDate.value);
    const records = track(() => savedLogs.value);
    const completedAt = records.find(
      (record) => record.date === date,
    )?.completedAt;
    try {
      historyDuration.value = parseLogs(historyInput.value, {
        date,
        now: new Date(),
        completedAt,
        expectedDate: date,
      }).duration;
      historyError.value = null;
    } catch (cause) {
      historyError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
    }
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
      <TodayLogPanel
        date={selectedDate.value}
        input={input.value}
        currentDutyEntry={currentDutyEntry.value}
        calculatedDuration={todayBreakdownDuration.value}
        error={error.value}
        storageError={storageError.value}
        storageMessage={storageMessage.value}
        loadedRecord={loadedRecord.value}
        isDayComplete={Boolean(loadedRecord.value?.completedAt)}
        historyOpen={historyOpen.value}
        storageReady={storageReady.value}
        isLoadingDay={isLoadingDay.value}
        isSaving={isSaving.value}
        onOpenHistory={openHistory}
        onSaveLog={saveEditedLog}
        onAddStatus={addStatusEntry}
        onSetDayComplete={$((completed: boolean) => {
          if (
            !selectedDate.value ||
            selectedDate.value !== getLocalDateKey(new Date()) ||
            isSaving.value
          ) {
            return Promise.resolve(false);
          }
          const completedAt = completed ? new Date().toISOString() : null;
          const previousCompletedAt =
            loadedRecord.value?.date === selectedDate.value
              ? (loadedRecord.value.completedAt ?? null)
              : null;
          return persistLog(
            selectedDate.value,
            input.value,
            completedAt,
            previousCompletedAt,
          );
        })}
      />

      {historyOpen.value && (
        <HistoryDrawer
          date={historyDate.value}
          today={getPreviousLocalDateKey(getLocalDateKey(new Date()))}
          input={historyInput.value}
          duration={historyDuration.value}
          error={historyError.value}
          storageError={historyStorageError.value}
          savedLogs={savedLogs.value}
          isLoading={isHistoryLoading.value}
          isSaving={isHistorySaving.value}
          onSelectDay={openHistoricalDay}
          onInput={$((logText: string) => {
            historyInput.value = logText;
          })}
          onSave={saveHistoricalDay}
          onDiscard={discardHistoricalChanges}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "HOSentinel",
  meta: [
    {
      name: "description",
      content: "An app to help drivers fill out their HOS logs",
    },
  ],
};
