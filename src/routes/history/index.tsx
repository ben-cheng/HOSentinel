import { component$, useComputed$, useVisibleTask$, useSignal, $ } from "@qwik.dev/core";
import { type DocumentHead } from "@qwik.dev/router";
import { HistoryList } from "~/components/hos-log/history-list";
import { buildHistoryItems } from "~/components/hos-log/history-items";
import { useStorageLogs } from "~/components/hos-log/use-storage-logs";
import { saveHosLog } from "~/components/hos-log/hos-log-storage";
import {
  formatDailyLog,
  finalizeCompletedLogEntries,
  parseLogs,
} from "~/components/hos-log/hos-log-normalizer";
import {
  getLocalDateKey,
  getPreviousLocalDateKey,
} from "~/components/hos-log/date-utils";

export default component$(() => {
  const { savedLogs, refreshSavedLogs } = useStorageLogs();
  const storageError = useSignal<string | null>(null);
  const maxDate = getPreviousLocalDateKey(getLocalDateKey(new Date()));
  const items = useComputed$(() => buildHistoryItems(savedLogs.value, maxDate));

  // Runs on mount, including client-side navigation (window "load" would not).
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async () => {
      try {
        await refreshSavedLogs();
      } catch (cause) {
        storageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to open local HOS log storage.";
      }
    },
    { strategy: "document-ready" },
  );

  const saveDay = $(async (date: string, log: string) => {
    if (!date || date >= getLocalDateKey(new Date())) return false;
    try {
      const existing = savedLogs.value.find((record) => record.date === date);
      const parsed = parseLogs(log, {
        date,
        completedAt: existing?.completedAt,
        expectedDate: date,
      });
      const entries = existing?.completedAt
        ? finalizeCompletedLogEntries(
            parsed.canonicalEntries,
            existing.completedAt,
          )
        : parsed.canonicalEntries;
      await saveHosLog({
        date,
        logText: formatDailyLog(date, entries).replace(/\s/g, ""),
        updatedAt: new Date().toISOString(),
        completedAt: existing?.completedAt ?? null,
      });
      await refreshSavedLogs();
      return true;
    } catch (cause) {
      storageError.value =
        cause instanceof Error ? cause.message : "Failed to save this day's log.";
      return false;
    }
  });

  return (
    <div class="space-y-4">
      <h2 class="text-xl font-bold tracking-tight text-slate-900">
        Log history
      </h2>
      {storageError.value && (
        <p role="alert" class="text-sm text-red-600">
          Local storage error: {storageError.value}
        </p>
      )}
      <HistoryList
        items={items.value}
        maxDate={maxDate}
        onSave$={saveDay}
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: "History · HOSentinel",
};
