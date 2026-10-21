import {
  component$,
  useSignal,
  $,
  useTask$,
  useOnWindow,
  isServer,
  useContext,
} from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { HosContext } from "~/components/hos-log/hours-of-service";
import type { DailyLog, LogEntry as DailyLogEntry } from "~/components/hos-log/hours-of-service";
import {
  isStatusKey,
  STATUS_MAP,
} from "~/components/hos-log/hours-of-service";
import {
  formatDailyLog,
  parseLogs,
} from "~/components/hos-log/hos-log-normalizer";
import { getHosLog } from "~/components/hos-log/hos-log-storage";
import { HistoryDrawer } from "~/components/hos-log/history-drawer";
import { TodayLogPanel } from "~/components/hos-log/today-log-panel";
import { useTodayLog } from "~/components/hos-log/use-today-log";
import { useHistoryLog } from "~/components/hos-log/use-history-log";
import { useStorageLogs } from "~/components/hos-log/use-storage-logs";
import {
  getLocalDateKey,
  getMinuteOfDay,
  getPreviousLocalDateKey,
  isToday,
} from "~/components/hos-log/date-utils";

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

export default component$(() => {
  const dailyLog = useContext(HosContext);
  const currentDate = useSignal(getLocalDateKey(new Date()));
  const currentMinute = useSignal(getMinuteOfDay(new Date()));

  // Use composable hooks for state management
  const todayLog = useTodayLog();
  const { savedLogs, storageReady, refreshSavedLogs, getStartingStatus } =
    useStorageLogs();
  const historyLog = useHistoryLog(savedLogs);

  // Update time every 15 seconds
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

  // Update dailyLog context
  useTask$(({ track }) => {
    const date = track(() => todayLog.date.value);
    const logText = track(() => todayLog.input.value);
    const completedAt = track(() =>
      todayLog.loadedRecord.value?.completedAt ?? null
    );
    if (date) {
      try {
        const parsed = parseLogs(logText, {
          date,
          now: new Date(),
          completedAt,
          expectedDate: date,
        });
        dailyLog.value = toDailyLog(
          parsed.date,
          parsed.canonicalEntries,
          completedAt,
        );
      } catch (error) {
        console.error("Failed to update dailyLog context:", error);
      }
    }
  });

  // Process status entry queue when ready
  useTask$(({ track }) => {
    const saving = track(() => todayLog.isSaving.value);
    const loading = track(() => todayLog.isLoadingDay.value);
    const queueLength = track(() => todayLog.pendingStatusEntries.value.length);
    const processing = track(() => todayLog.isProcessingStatusEntries.value);
    if (!saving && !loading && !processing && queueLength > 0) {
      todayLog.processPendingStatusEntries();
    }
  });

  // Load today's log on mount
  useOnWindow(
    "load",
    $(async () => {
      const today = getLocalDateKey(new Date());
      todayLog.date.value = today;
      try {
        await refreshSavedLogs();
        const record = await getHosLog(today);
        const carryStatus = record ? "O" : await getStartingStatus(today);
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
        const displayLog = formatDailyLog(
          today,
          parsedRecord.canonicalEntries,
        );
        todayLog.loadedRecord.value = record
          ? { ...record, logText: displayLog }
          : null;
        todayLog.input.value = displayLog;
        if (!record) {
          await todayLog.persistLog(today, carryStatus);
        }
      } catch (cause) {
        await todayLog.showSaveError(
          cause instanceof Error
            ? cause.message
            : "Failed to open local HOS log storage.",
        );
      }
    }),
  );

  // Roll over to today if date changed
  const rollOverToToday = $(async () => {
    const today = getLocalDateKey(new Date());
    if (todayLog.date.value === today || todayLog.isLoadingDay.value) return;

    todayLog.isLoadingDay.value = true;
    todayLog.clearMessages();
    try {
      await refreshSavedLogs();
      const record = await getHosLog(today);
      const startingStatus = record
        ? "O"
        : await getStartingStatus(today);
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
      todayLog.date.value = today;
      todayLog.loadedRecord.value = record
        ? { ...record, logText: displayLog }
        : null;
      todayLog.input.value = displayLog;
      if (!record) {
        await todayLog.persistLog(today, startingStatus);
      }
    } catch (cause) {
      await todayLog.showSaveError(
        cause instanceof Error ? cause.message : "Failed to load today's log.",
      );
    } finally {
      todayLog.isLoadingDay.value = false;
    }
  });

  // Watch for date changes
  useTask$(({ track }) => {
    const today = track(() => currentDate.value);
    const selected = track(() => todayLog.date.value);
    const ready = track(() => storageReady.value);
    if (!isServer && ready && selected && selected !== today) {
      rollOverToToday();
    }
  });

  // Save edited log
  const saveEditedLog = $(async (logText: string) => {
    if (!todayLog.date.value) return false;
    const previousCompletedAt =
      todayLog.loadedRecord.value?.date === todayLog.date.value
        ? (todayLog.loadedRecord.value.completedAt ?? null)
        : null;
    return todayLog.persistLog(
      todayLog.date.value,
      logText,
      previousCompletedAt,
      previousCompletedAt,
      isToday(todayLog.date.value),
    );
  });

  // Open history to most recent past log
  const openHistory = $(() => {
    const yesterday = getPreviousLocalDateKey(getLocalDateKey(new Date()));
    const mostRecentPastLog = savedLogs.value.find(
      (record) => record.date < getLocalDateKey(new Date()),
    );
    historyLog.openHistoricalDay(mostRecentPastLog?.date ?? yesterday);
  });

  // Handle day complete toggle
  const setDayComplete = $(async (completed: boolean) => {
    if (
      !todayLog.date.value ||
      !isToday(todayLog.date.value) ||
      todayLog.isSaving.value
    ) {
      return false;
    }
    const completedAt = completed ? new Date().toISOString() : null;
    const previousCompletedAt =
      todayLog.loadedRecord.value?.date === todayLog.date.value
        ? (todayLog.loadedRecord.value.completedAt ?? null)
        : null;
    return todayLog.persistLog(
      todayLog.date.value,
      todayLog.input.value,
      completedAt,
      previousCompletedAt,
      completed,
    );
  });

  // Add status button handler (with guard for history/completed)
  const addStatusEntry = $(async (status: "O" | "D" | "N") => {
    if (
      historyLog.open.value ||
      todayLog.loadedRecord.value?.completedAt
    ) {
      return;
    }

    // Ensure we're on today
    if (!isToday(todayLog.date.value)) {
      await rollOverToToday();
      if (todayLog.storageError.value) return;
    }

    await todayLog.queueStatusEntry(status);
    await todayLog.processPendingStatusEntries();
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
      <TodayLogPanel
        date={todayLog.date.value}
        input={todayLog.input.value}
        currentDutyEntry={todayLog.currentDutyEntry.value}
        calculatedDuration={todayLog.calculatedDuration.value}
        error={todayLog.error.value}
        storageError={todayLog.storageError.value}
        storageMessage={todayLog.storageMessage.value}
        loadedRecord={todayLog.loadedRecord.value}
        isDayComplete={todayLog.isDayComplete.value}
        historyOpen={historyLog.open.value}
        storageReady={storageReady.value}
        isLoadingDay={todayLog.isLoadingDay.value}
        isSaving={todayLog.isSaving.value}
        onOpenHistory={openHistory}
        onSaveLog={saveEditedLog}
        onAddStatus={addStatusEntry}
        onSetDayComplete={setDayComplete}
      />

      {historyLog.open.value && (
        <HistoryDrawer
          date={historyLog.historyDate.value}
          today={getPreviousLocalDateKey(getLocalDateKey(new Date()))}
          input={historyLog.historyInput.value}
          duration={historyLog.historyDuration.value}
          error={historyLog.historyError.value}
          storageError={historyLog.historyStorageError.value}
          savedLogs={savedLogs.value}
          isLoading={historyLog.isHistoryLoading.value}
          isSaving={historyLog.isHistorySaving.value}
          onSelectDay={historyLog.openHistoricalDay}
          onInput={$(
            (value: string) => {
              historyLog.historyInput.value = value;
            },
          )}
          onSave={historyLog.saveHistoricalDay}
          onDiscard={historyLog.discardChanges}
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
