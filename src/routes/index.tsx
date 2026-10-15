import {
  component$,
  useSignal,
  $,
  useTask$,
  useOnWindow,
  isServer,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  formatLogEntries,
  getFinalStatus,
  getActiveDutyEntry,
  getDurationWithOffDutyRemainder,
  parseLogs,
} from "~/libs/hos-log-normalizer";
import type { ParseResult } from "~/libs/hos-log-normalizer";
import { updateLogForStatus } from "~/libs/hos-log-status-updater";
import { getHosLog, listHosLogs, saveHosLog } from "~/libs/hos-log-storage";
import type { HosLogRecord } from "~/libs/hos-log-storage";
import { DutyEntry } from "~/models/duty-entry";
import {
  createEmptyStatusDuration,
  StatusDuration,
} from "~/models/duty-status";
import { HistoryDrawer } from "~/components/hos-log/history-drawer";
import { TodayLogPanel } from "~/components/hos-log/today-log-panel";

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

  return getFinalStatus(parseLogs(previousRecord.logText).value);
}

export default component$(() => {
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
  const historyBaseline = useSignal("");
  const isHistoryLoading = useSignal(false);
  const isHistorySaving = useSignal(false);
  const storageReady = useSignal(false);
  const isLoadingDay = useSignal(false);
  const isSaving = useSignal(false);
  const historyRequestId = useSignal(0);
  const currentMinute = useSignal(getMinuteOfDay(new Date()));
  const currentDutyEntry = useSignal<DutyEntry>();

  const updateCurrentLogState = $((logText: string): ParseResult | null => {
    try {
      const parsed = parseLogs(logText);
      result.value = parsed.value;
      calculatedDuration.value = parsed.duration;
      error.value = parsed.error;
      return parsed;
    } catch (cause) {
      result.value = [];
      calculatedDuration.value = createEmptyStatusDuration();
      error.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
      return null;
    }
  });

  useTask$(({ track }) => {
    const entries = track(() => result.value);
    const minute = track(() => currentMinute.value);
    const date = track(() => selectedDate.value);
    const activeEntry = getActiveDutyEntry(entries, minute);
    currentDutyEntry.value = activeEntry;

    todayBreakdownDuration.value =
      date === getLocalDateKey(new Date()) &&
      activeEntry &&
      activeEntry?.status !== "OFF_DUTY"
        ? getDurationWithOffDutyRemainder(entries, minute)
        : calculatedDuration.value;
  });

  useTask$(({ cleanup }) => {
    if (isServer) return;

    const updateCurrentMinute = () => {
      const now = new Date();
      currentMinute.value = getMinuteOfDay(now);
    };
    updateCurrentMinute();
    const interval = setInterval(updateCurrentMinute, 15_000);
    cleanup(() => clearInterval(interval));
  });

  const refreshSavedLogs = $(async () => {
    const records = await listHosLogs();
    savedLogs.value = records;
    return records;
  });

  const persistLog = $(async (date: string, logText: string) => {
    if (isSaving.value) return false;

    storageError.value = null;
    storageMessage.value = null;
    const parsed = await updateCurrentLogState(logText);
    if (!parsed) return false;
    isSaving.value = true;
    try {
      const displayLog = formatLogEntries(parsed.value).join("\n");
      const record: HosLogRecord = {
        date,
        logText: displayLog.replace(/\s/g, ""),
        updatedAt: new Date().toISOString(),
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
  });

  const openHistoricalDay = $(async (date: string) => {
    if (!date || date >= getLocalDateKey(new Date())) return;
    if (historyOpen.value && historyDate.value === date) return;
    if (
      historyOpen.value &&
      historyInput.value !== historyBaseline.value &&
      !window.confirm("Discard your unsaved changes and open another day?")
    ) {
      return;
    }

    const requestId = ++historyRequestId.value;
    historyOpen.value = true;
    historyDate.value = date;
    historyError.value = null;
    historyStorageError.value = null;
    historyInput.value = "O";
    historyBaseline.value = "";
    isHistoryLoading.value = true;

    try {
      const record = await getHosLog(date);
      if (requestId !== historyRequestId.value) return;
      const records = savedLogs.value.length
        ? savedLogs.value
        : await listHosLogs();
      const carryStatus = record ? "O" : getStartingStatus(date, records);
      const displayLog = record
        ? formatLogEntries(parseLogs(record.logText).value).join("\n")
        : carryStatus;
      const parsed = parseLogs(displayLog);
      historyInput.value = displayLog;
      historyBaseline.value = displayLog;
      historyDuration.value = parsed.duration;
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
    historyBaseline.value = "";
  });

  const saveHistoricalDay = $(async () => {
    if (!historyDate.value || isHistorySaving.value) return;

    historyError.value = null;
    historyStorageError.value = null;
    let parsed;

    try {
      parsed = parseLogs(historyInput.value);
    } catch (cause) {
      historyError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
      return;
    }

    historyDuration.value = parsed.duration;
    isHistorySaving.value = true;
    try {
      const displayLog = formatLogEntries(parsed.value).join("\n");
      await saveHosLog({
        date: historyDate.value,
        logText: displayLog.replace(/\s/g, ""),
        updatedAt: new Date().toISOString(),
      });
      historyInput.value = displayLog;
      historyBaseline.value = displayLog;
      await refreshSavedLogs();
      discardHistoricalChanges();
    } catch (cause) {
      historyStorageError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to save this day's log.";
    } finally {
      isHistorySaving.value = false;
    }
  });

  const saveEditedLog = $(async (logText: string) => {
    if (!selectedDate.value) return false;
    return persistLog(selectedDate.value, logText);
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
    if (selectedDate.value === today) return;

    isLoadingDay.value = true;
    storageError.value = null;
    try {
      const records = await refreshSavedLogs();
      const record = await getHosLog(today);
      const startingStatus = record ? "O" : getStartingStatus(today, records);
      const displayLog = record
        ? formatLogEntries(parseLogs(record.logText).value).join("\n")
        : startingStatus;
      selectedDate.value = today;
      loadedRecord.value = record ? { ...record, logText: displayLog } : null;
      input.value = displayLog;
      if (!record) {
        await persistLog(today, startingStatus);
      } else {
        await updateCurrentLogState(displayLog);
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
        const displayLog = record
          ? formatLogEntries(parseLogs(record.logText).value).join("\n")
          : carryStatus;
        loadedRecord.value = record ? { ...record, logText: displayLog } : null;
        input.value = displayLog;
        if (!record) {
          await persistLog(today, carryStatus);
        } else {
          await updateCurrentLogState(displayLog);
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

  const addStatusEntry = $(async (status: "O" | "D" | "N") => {
    if (historyOpen.value || isSaving.value || isLoadingDay.value) return;

    const today = getLocalDateKey(new Date());
    if (selectedDate.value !== today) {
      await rollOverToToday();
      if (storageError.value) return;
    }

    const updatedLog = updateLogForStatus(input.value, status, new Date());
    if (updatedLog === input.value) return;
    input.value = updatedLog;
    if (selectedDate.value === today) {
      await persistLog(selectedDate.value, updatedLog);
    }
  });

  useTask$(({ track }) => {
    track(() => historyInput.value);
    try {
      historyDuration.value = parseLogs(historyInput.value).duration;
      historyError.value = null;
    } catch (cause) {
      historyError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to parse this day's log.";
    }
  });

  return (
    <div class="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <TodayLogPanel
        date={selectedDate.value}
        input={input.value}
        currentDutyEntry={currentDutyEntry.value}
        calculatedDuration={todayBreakdownDuration.value}
        error={error.value}
        storageError={storageError.value}
        storageMessage={storageMessage.value}
        loadedRecord={loadedRecord.value}
        historyOpen={historyOpen.value}
        storageReady={storageReady.value}
        isLoadingDay={isLoadingDay.value}
        isSaving={isSaving.value}
        onOpenHistory={openHistory}
        onSaveLog={saveEditedLog}
        onAddStatus={addStatusEntry}
      />

      {historyOpen.value && (
        <HistoryDrawer
          date={historyDate.value}
          today={getPreviousLocalDateKey(getLocalDateKey(new Date()))}
          input={historyInput.value}
          baseline={historyBaseline.value}
          duration={historyDuration.value}
          error={historyError.value}
          storageError={historyStorageError.value}
          savedLogs={savedLogs.value}
          isLoading={isHistoryLoading.value}
          isSaving={isHistorySaving.value}
          onSelectDay={openHistoricalDay}
          onInput={$((event: Event) => {
            historyInput.value = (event.target as HTMLTextAreaElement).value;
          })}
          onDiscard={discardHistoricalChanges}
          onSave={saveHistoricalDay}
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
