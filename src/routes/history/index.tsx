import { component$, useOnWindow, $ } from "@qwik.dev/core";
import { Link, type DocumentHead } from "@qwik.dev/router";
import { HistoryLogPanel } from "~/components/hos-log/history-log-panel";
import { useHistoryLog } from "~/components/hos-log/use-history-log";
import { useStorageLogs } from "~/components/hos-log/use-storage-logs";
import {
  getLocalDateKey,
  getPreviousLocalDateKey,
} from "~/components/hos-log/date-utils";

export default component$(() => {
  const { savedLogs, refreshSavedLogs } = useStorageLogs();
  const historyLog = useHistoryLog(savedLogs);

  useOnWindow(
    "load",
    $(async () => {
      const today = getLocalDateKey(new Date());
      try {
        const records = await refreshSavedLogs();
        const latestPast = records.find((record) => record.date < today);
        if (latestPast) await historyLog.openHistoricalDay(latestPast.date);
      } catch (cause) {
        historyLog.historyStorageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to open local HOS log storage.";
      }
    }),
  );

  return (
    <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
      <div class="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl shadow-slate-300/50">
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 p-6">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Historical record
            </p>
            <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {historyLog.historyDate.value
                ? new Date(
                    `${historyLog.historyDate.value}T00:00:00`,
                  ).toLocaleDateString()
                : "Select a day"}
            </h1>
          </div>
          <Link
            href="/"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to today
          </Link>
        </header>
        <div class="p-6">
          <HistoryLogPanel
            date={historyLog.historyDate.value}
            maxDate={getPreviousLocalDateKey(getLocalDateKey(new Date()))}
            input={historyLog.historyInput.value}
            error={historyLog.historyError.value}
            storageError={historyLog.historyStorageError.value}
            savedLogs={savedLogs.value}
            isLoading={historyLog.isHistoryLoading.value}
            isSaving={historyLog.isHistorySaving.value}
            onSelectDay={historyLog.openHistoricalDay}
            onInput={$((value: string) => {
              historyLog.historyInput.value = value;
            })}
            onSave={historyLog.saveHistoricalDay}
          />
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "History · HOSentinel",
};
