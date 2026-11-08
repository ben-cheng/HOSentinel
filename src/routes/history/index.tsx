import {
  component$,
  useComputed$,
  useVisibleTask$,
  useSignal,
  $,
  useContext,
} from "@qwik.dev/core";
import { type DocumentHead } from "@qwik.dev/router";
import { HistoryList } from "~/components/hos-log/history-list";
import { buildHistoryItems } from "~/components/hos-log/history-items";
import { HosStorageContext } from "~/components/hos-log/context/hos-storage-provider";
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
  const { savedLogs, refreshSavedLogs, saveLog } =
    useContext(HosStorageContext);
  const storageError = useSignal<string | null>(null);
  const loading = useSignal(true);
  const historyReady = useSignal(false);
  const historyLoaded = useSignal(false);
  const maxDate = getPreviousLocalDateKey(getLocalDateKey(new Date()));
  const items = useComputed$(() => buildHistoryItems(savedLogs.value, maxDate));

  const loadHistory = $(async () => {
    loading.value = true;
    historyReady.value = false;
    storageError.value = null;
    try {
      await refreshSavedLogs();
      historyReady.value = true;
      historyLoaded.value = true;
    } catch (cause) {
      storageError.value =
        cause instanceof Error
          ? cause.message
          : "Failed to open local HOS log storage.";
    } finally {
      loading.value = false;
    }
  });
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      loadHistory();
    },
    { strategy: "document-ready" },
  );

  const saveDay = $(
    async (
      date: string,
      log: string,
      expectedUpdatedAt: string | null,
      completedAt: string | null,
    ) => {
      if (
        !historyReady.value ||
        loading.value ||
        !date ||
        date >= getLocalDateKey(new Date())
      )
        return false;
      try {
        const parsed = parseLogs(log, {
          date,
          completedAt,
          expectedDate: date,
        });
        const entries = completedAt
          ? finalizeCompletedLogEntries(parsed.canonicalEntries, completedAt)
          : parsed.canonicalEntries;
        await saveLog(
          {
            date,
            logText: formatDailyLog(date, entries).replace(/\s/g, ""),
            updatedAt: new Date().toISOString(),
            completedAt,
          },
          expectedUpdatedAt,
        );
        return true;
      } catch (cause) {
        historyReady.value = false;
        storageError.value =
          cause instanceof Error
            ? cause.message
            : "Failed to save this day's log.";
        return false;
      }
    },
  );

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          Log history
        </h2>
        <p class="mt-1 text-sm text-slate-600">
          Select a past day to review its duty entries and timeline.
        </p>
      </div>
      {storageError.value && (
        <div role="alert" class="space-y-2 text-sm text-red-600">
          <p>Local storage error: {storageError.value}</p>
          <button
            type="button"
            class="rounded-lg border border-red-300 px-3 py-2 font-semibold"
            onClick$={loadHistory}
          >
            Reload history
          </button>
        </div>
      )}
      {loading.value && (
        <p role="status" class="text-sm text-slate-600">
          Loading history...
        </p>
      )}
      {historyLoaded.value && (
        <HistoryList
          items={items.value}
          maxDate={maxDate}
          onSave$={saveDay}
          disabled={!historyReady.value || loading.value}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "History · HOSentinel",
};
