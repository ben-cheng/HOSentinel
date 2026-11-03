import { component$, useComputed$, useVisibleTask$, useSignal, $ } from "@qwik.dev/core";
import { Link, type DocumentHead } from "@qwik.dev/router";
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
    <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
      <div class="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl shadow-slate-300/50">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 p-6">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              HOSentinel
            </p>
            <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Log history
            </h1>
          </div>
          <Link
            href="/"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to today
          </Link>
        </header>
        <div class="space-y-4 p-6">
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
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "History · HOSentinel",
};
