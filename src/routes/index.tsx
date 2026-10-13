import {
  component$,
  useSignal,
  $,
  useTask$,
  useOnWindow,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import {
  formatLogEntries,
  getFinalStatus,
  parseLogs,
} from "~/libs/hos-log-normalizer";
import {
  getHosLog,
  HosLogRecord,
  listHosLogs,
  saveHosLog,
} from "~/libs/hos-log-storage";
import { DutyEntry } from "~/models/duty-entry";
import { createEmptyStatusDuration, isStatusKey, STATUS_LABEL, STATUS_MAP, StatusDuration } from "~/models/duty-status";

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const calculatedDuration = useSignal<StatusDuration>(createEmptyStatusDuration());
  const error = useSignal<string | null>(null);
  const storageError = useSignal<string | null>(null);
  const storageMessage = useSignal<string | null>(null);
  const savedLogs = useSignal<HosLogRecord[]>([]);
  const loadedRecord = useSignal<HosLogRecord | null>(null);
  const historyOpen = useSignal(false);
  const historyDate = useSignal("");
  const historyInput = useSignal("");
  const historyDuration = useSignal<StatusDuration>(createEmptyStatusDuration());
  const historyError = useSignal<string | null>(null);
  const historyStorageError = useSignal<string | null>(null);
  const historyBaseline = useSignal("");
  const isHistoryLoading = useSignal(false);
  const isHistorySaving = useSignal(false);
  const storageReady = useSignal(false);
  const isLoadingDay = useSignal(false);
  const isSaving = useSignal(false);
  const historyRequestId = useSignal(0);

  const refreshSavedLogs = $(async () => {
    const records = await listHosLogs();
    savedLogs.value = records;
    return records;
  });

  const persistLog = $(async (date: string, logText: string) => {
    if (isSaving.value) return false;

    storageError.value = null;
    storageMessage.value = null;
    error.value = null;

    let parsed;
    try {
      parsed = parseLogs(logText);
    } catch (cause) {
      result.value = [];
      error.value =
        cause instanceof Error ? cause.message : "Failed to parse this day's log.";
      return false;
    }

    calculatedDuration.value = parsed.duration;
    result.value = parsed.value;
    error.value = parsed.error;
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
        cause instanceof Error ? cause.message : "Failed to save this day's log.";
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
          cause instanceof Error ? cause.message : "Failed to load this day's log.";
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
        cause instanceof Error ? cause.message : "Failed to parse this day's log.";
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
        cause instanceof Error ? cause.message : "Failed to save this day's log.";
    } finally {
      isHistorySaving.value = false;
    }
  });

  const saveCurrentDay = $(async () => {
    if (!selectedDate.value) return;
    await persistLog(selectedDate.value, input.value);
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
      const startingStatus = record
        ? "O"
        : getStartingStatus(today, records);
      const displayLog = record
        ? formatLogEntries(parseLogs(record.logText).value).join("\n")
        : startingStatus;
      selectedDate.value = today;
      loadedRecord.value = record
        ? { ...record, logText: displayLog }
        : null;
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
        const displayLog = record
          ? formatLogEntries(parseLogs(record.logText).value).join("\n")
          : carryStatus;
        loadedRecord.value = record
          ? { ...record, logText: displayLog }
          : null;
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

  const addStatusEntry = $(async (status: "O" | "D" | "N") => {
    if (historyOpen.value || isSaving.value || isLoadingDay.value) return;

    const today = getLocalDateKey(new Date());
    if (selectedDate.value !== today) {
      await rollOverToToday();
      if (storageError.value) return;
    }

    const lines = input.value.split("\n");
    let previousLineIndex = lines.length - 1;
    while (previousLineIndex >= 0 && !lines[previousLineIndex].trim()) {
      previousLineIndex--;
    }
    const previousLine = lines[previousLineIndex]?.replace(/\s+/g, "");

    if (previousLine?.length === 1 && previousLine.toUpperCase() === status) {
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const transitionEntry = previousLine?.match(/^(\d{1,2}:?\d{2})([A-Za-z])$/);
    const intervalEndEntry = previousLine?.match(/^([A-Za-z])(\d{1,2}:?\d{2})$/);
    const previousStatus = transitionEntry?.[2] ?? intervalEndEntry?.[1];
    const previousTimeRaw = transitionEntry?.[1] ?? intervalEndEntry?.[2];
    const previousTimeFirst = Boolean(transitionEntry);

    if (
      previousStatus &&
      previousTimeRaw &&
      isStatusKey(previousStatus.toUpperCase())
    ) {
      const previousTime = previousTimeRaw.replace(":", "").padStart(4, "0");

      if (previousTime === time) {
        lines[previousLineIndex] = previousTimeFirst
          ? `${previousTimeRaw}${status}`
          : `${status}${previousTimeRaw}`;
        const updatedLog = lines.join("\n");
        input.value = updatedLog;
        if (selectedDate.value === today) {
          await persistLog(selectedDate.value, updatedLog);
        }
        return;
      }

      if (previousStatus.toUpperCase() === status) {
        lines[previousLineIndex] = previousTimeFirst
          ? `${time}${status}`
          : `${status}${time}`;
        const updatedLog = lines.join("\n");
        input.value = updatedLog;
        if (selectedDate.value === today) {
          await persistLog(selectedDate.value, updatedLog);
        }
        return;
      }
    }

    const separator = input.value.trim() ? "\n" : "";
    const updatedLog = `${input.value.trimEnd()}${separator}${time}${status}`;
    input.value = updatedLog;
    if (selectedDate.value === today) {
      await persistLog(selectedDate.value, updatedLog);
    }
  });

  const handleParse = $(() => {
    error.value = null;

    try {
      const { duration, value, error: err } = parseLogs(input.value);

      calculatedDuration.value = duration;
      result.value = value;
      error.value = err;
    } catch (e: any) {
      result.value = [];
      error.value = e.message || "Failed to parse logs";
    }
  });

  useTask$(({ track, cleanup }) => {
    track(() => input.value);
    const id = setTimeout(() => {
      handleParse();
    }, 500);
    cleanup(() => {
      clearTimeout(id);
      // Cleanup logic if needed
    });
  });

  useTask$(({ track }) => {
    track(() => historyInput.value);
    try {
      historyDuration.value = parseLogs(historyInput.value).duration;
      historyError.value = null;
    } catch (cause) {
      historyError.value =
        cause instanceof Error ? cause.message : "Failed to parse this day's log.";
    }
  });

  return (
    <div class="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <div
        class="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6"
        aria-hidden={historyOpen.value}
        inert={historyOpen.value}
      >
        
        {/* Title */}
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            HOS Log Parser
          </h1>
          <p class="text-sm text-gray-500">
            Enter status changes. A timestamp followed by a status starts that status at the given time; spaces are ignored. The day defaults to Off-duty (O).
          </p>
        </div>

        <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
          <div>
            <h2 class="text-sm font-semibold text-gray-700">Today</h2>
            <p class="text-sm text-gray-500">
              {new Date(`${selectedDate.value}T00:00:00`).toLocaleDateString()}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            {loadedRecord.value && input.value !== loadedRecord.value.logText && (
              <span class="text-sm font-medium text-amber-700">Unsaved changes</span>
            )}
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
              onClick$={openHistory}
            >
              View past logs
            </button>
            <button
              type="button"
              class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!storageReady.value || !selectedDate.value || isLoadingDay.value || isSaving.value}
              onClick$={saveCurrentDay}
            >
              {isSaving.value ? "Saving..." : "Save today"}
            </button>
          </div>
          {storageError.value && (
            <p role="alert" class="w-full text-sm text-red-600">
              Local storage error: {storageError.value}
            </p>
          )}
          {storageMessage.value && (
            <p role="status" class="w-full text-sm text-green-700">
              {storageMessage.value}
            </p>
          )}
        </section>

        <div>
          <label
            for="hos-log"
            class="mb-2 block text-sm font-semibold text-gray-700"
          >
            Daily HOS log
          </label>
          <textarea
            id="hos-log"
            class="w-full h-48 p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
            value={input.value}
            onInput$={(e) =>
              (input.value = (e.target as HTMLTextAreaElement).value)
            }
          />
        </div>

        {!historyOpen.value && (
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
              onClick$={() => addStatusEntry("O")}
            >
              Off-duty
            </button>
            <button
              type="button"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
              onClick$={() => addStatusEntry("D")}
            >
              Driving
            </button>
            <button
              type="button"
              class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
              onClick$={() => addStatusEntry("N")}
            >
              On-duty not driving
            </button>
          </div>
        )}

        <div class="flex justify-between items-center min-h-6">
          {error.value && (
            <span class="text-sm text-red-500">{error.value}</span>
          )}
        </div>

        {/* Result */}
        <div>
          <h2 class="text-lg font-semibold text-gray-700 mb-2">
            Parsed Output
          </h2>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 class="text-sm font-semibold text-blue-700">
              Duration Breakdown
            </h3>

            <div class="space-y-2">
              {Object.entries(calculatedDuration.value).map(([key, minutes]) => {
                const hours = Number((minutes / 60).toFixed(2));

                return (
                  <div
                    key={key}
                    class="flex justify-between items-center text-sm"
                  >
                    <span class="text-gray-700">
                      {STATUS_LABEL[key as keyof typeof STATUS_MAP]}
                    </span>

                    <span class="font-semibold text-blue-800">
                      {hours} h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {historyOpen.value && (
        <div class="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            class="absolute inset-0 bg-black/20"
            aria-label="Discard historical changes and close"
            onClick$={discardHistoricalChanges}
          />
          <aside
            class="relative flex h-full w-full max-w-xl animate-[history-slide-in_250ms_ease-out] flex-col bg-white shadow-2xl"
            aria-label="Historical HOS log"
          >
            <header class="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Historical record
                </p>
                <h2 class="mt-1 text-xl font-bold text-gray-800">
                  {historyDate.value
                    ? new Date(`${historyDate.value}T00:00:00`).toLocaleDateString()
                    : "Select a day"}
                </h2>
                {historyInput.value !== historyBaseline.value && (
                  <p class="mt-1 text-sm font-medium text-amber-700">
                    Unsaved changes
                  </p>
                )}
              </div>
              <button
                type="button"
                class="rounded-lg p-2 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Discard changes and close"
                onClick$={discardHistoricalChanges}
              >
                &times;
              </button>
            </header>

            <div class="flex-1 space-y-5 overflow-y-auto p-5">
              <label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-gray-700">
                Select historical day
                <input
                  type="date"
                  max={getPreviousLocalDateKey(getLocalDateKey(new Date()))}
                  class="rounded-lg border border-gray-300 px-3 py-2"
                  value={historyDate.value}
                  disabled={isHistoryLoading.value || isHistorySaving.value}
                  onInput$={(event) => {
                    const date = (event.target as HTMLInputElement).value;
                    if (date) openHistoricalDay(date);
                  }}
                />
              </label>

              <div>
                <h3 class="mb-2 text-sm font-semibold text-gray-700">
                  Saved historical days
                </h3>
                {savedLogs.value.some(
                  (record) => record.date < getLocalDateKey(new Date()),
                ) ? (
                  <div class="flex flex-wrap gap-2">
                    {savedLogs.value
                      .filter(
                        (record) => record.date < getLocalDateKey(new Date()),
                      )
                      .map((record) => (
                        <button
                          key={record.date}
                          type="button"
                          disabled={
                            isHistoryLoading.value || isHistorySaving.value
                          }
                          class={`rounded-full border px-3 py-1 text-sm ${
                            historyDate.value === record.date
                              ? "border-blue-700 bg-blue-50 text-blue-800"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                          onClick$={() => openHistoricalDay(record.date)}
                        >
                          {new Date(
                            `${record.date}T00:00:00`,
                          ).toLocaleDateString()}
                        </button>
                      ))}
                  </div>
                ) : (
                  <p class="text-sm text-gray-500">
                    No saved historical logs yet.
                  </p>
                )}
              </div>

              {historyStorageError.value && (
                <p role="alert" class="text-sm text-red-600">
                  Local storage error: {historyStorageError.value}
                </p>
              )}

              <div>
                <label
                  for="historical-hos-log"
                  class="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Daily HOS log
                </label>
                <textarea
                  id="historical-hos-log"
                  class="h-48 w-full rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  disabled={
                    isHistoryLoading.value || isHistorySaving.value
                  }
                  value={historyInput.value}
                  onInput$={(event) =>
                    (historyInput.value = (
                      event.target as HTMLTextAreaElement
                    ).value)
                  }
                />
                {historyError.value && (
                  <p role="alert" class="mt-2 text-sm text-red-600">
                    {historyError.value}
                  </p>
                )}
              </div>

              <section class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 class="mb-3 text-sm font-semibold text-blue-700">
                  Duration Breakdown
                </h3>
                <div class="space-y-2">
                  {Object.entries(historyDuration.value).map(
                    ([key, minutes]) => (
                      <div
                        key={key}
                        class="flex justify-between text-sm"
                      >
                        <span class="text-gray-700">
                          {STATUS_LABEL[key as keyof typeof STATUS_MAP]}
                        </span>
                        <span class="font-semibold text-blue-800">
                          {Number((minutes / 60).toFixed(2))} h
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </section>
            </div>

            <footer class="flex justify-end gap-3 border-t border-gray-200 p-5">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isHistoryLoading.value || isHistorySaving.value}
                onClick$={discardHistoricalChanges}
              >
                Discard
              </button>
              <button
                type="button"
                class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isHistoryLoading.value ||
                  isHistorySaving.value ||
                  !historyDate.value ||
                  Boolean(historyError.value) ||
                  historyInput.value === historyBaseline.value
                }
                onClick$={saveHistoricalDay}
              >
                {isHistorySaving.value ? "Saving..." : "Save changes"}
              </button>
            </footer>
          </aside>
        </div>
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
