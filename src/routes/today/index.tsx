import {
  component$,
  useComputed$,
  $,
  useTask$,
  useVisibleTask$,
  isServer,
  useContext,
} from "@qwik.dev/core";
import { HosStorageContext } from "~/components/hos-log/context/hos-storage-provider";
import type { DocumentHead } from "@qwik.dev/router";
import { HosContext } from "~/components/hos-log/hours-of-service";
import type {
  DailyLog,
  LogEntry as DailyLogEntry,
} from "~/components/hos-log/hours-of-service";
import { isStatusKey, STATUS_MAP } from "~/components/hos-log/hours-of-service";
import {
  formatDailyLog,
  parseLogs,
} from "~/components/hos-log/hos-log-normalizer";
import { TodayLogView } from "~/components/hos-log/today-log-view";
import { useNow } from "~/components/time/use-now";
import { useTodayLog } from "~/components/hos-log/use-today-log";
import { getLocalDateKey, isToday } from "~/components/hos-log/date-utils";

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
  const now = useNow(60_000);
  const currentDate = useComputed$(() => getLocalDateKey(new Date(now.value)));

  // Use composable hooks for state management
  const todayLog = useTodayLog(now);
  const { storageReady, refreshSavedLogs, getStartingStatus, getLog } =
    useContext(HosStorageContext);

  // Update dailyLog context
  useTask$(({ track }) => {
    const date = track(() => todayLog.date.value);
    const logText = track(() => todayLog.input.value);
    const completedAt = track(
      () => todayLog.loadedRecord.value?.completedAt ?? null,
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
  // Runs on mount, including client-side navigation (window "load" would not).
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async () => {
      const today = getLocalDateKey(new Date());
      todayLog.date.value = today;
      try {
        await refreshSavedLogs();
        const record = await getLog(today);
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
        const displayLog = formatDailyLog(today, parsedRecord.canonicalEntries);
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
    },
    { strategy: "document-ready" },
  );

  // Roll over to today if date changed
  const rollOverToToday = $(async () => {
    const today = getLocalDateKey(new Date());
    if (todayLog.date.value === today || todayLog.isLoadingDay.value) return;

    todayLog.isLoadingDay.value = true;
    todayLog.clearMessages();
    try {
      await refreshSavedLogs();
      const record = await getLog(today);
      const startingStatus = record ? "O" : await getStartingStatus(today);
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

  // Status switcher emits the full updated log
  const applyStatusLog = $(async (logText: string) => {
    if (todayLog.loadedRecord.value?.completedAt) return;
    if (!isToday(todayLog.date.value)) {
      await rollOverToToday();
      if (todayLog.storageError.value) return;
    }
    todayLog.input.value = logText;
    await todayLog.persistLog(todayLog.date.value, logText);
  });

  return (
    <TodayLogView
      now={now.value}
      date={todayLog.date.value}
      log={todayLog.input.value}
      isComplete={todayLog.isDayComplete.value}
      disabled={
        !storageReady.value ||
        todayLog.isLoadingDay.value ||
        todayLog.isSaving.value
      }
      error={todayLog.error.value}
      storageError={todayLog.storageError.value}
      storageMessage={todayLog.storageMessage.value}
      onChange$={applyStatusLog}
      onSave$={saveEditedLog}
      onSetComplete$={setDayComplete}
    />
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
