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
  const storageReady = useSignal(false);
  const isLoadingDay = useSignal(false);
  const isSaving = useSignal(false);
  const trackingToday = useSignal(true);
  const loadRequestId = useSignal(0);

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

  const loadDay = $(async (date: string) => {
    const requestId = ++loadRequestId.value;
    selectedDate.value = date;
    trackingToday.value = date === getLocalDateKey(new Date());
    storageError.value = null;
    storageMessage.value = null;
    error.value = null;
    loadedRecord.value = null;
    input.value = "O";

    if (!date) {
      return;
    }

    isLoadingDay.value = true;
    try {
      const record = await getHosLog(date);
      if (requestId !== loadRequestId.value) return;
      const carryStatus = record ? "O" : getStartingStatus(date, savedLogs.value);
      const displayLog = record
        ? formatLogEntries(parseLogs(record.logText).value).join("\n")
        : carryStatus;
      loadedRecord.value = record
        ? { ...record, logText: displayLog }
        : null;
      input.value = displayLog;
      if (!record) {
        if (trackingToday.value) {
          await persistLog(date, carryStatus);
        } else {
          storageMessage.value = `No saved log for this day. Starting with ${carryStatus}.`;
        }
      }
    } catch (cause) {
      if (requestId === loadRequestId.value) {
        storageError.value =
          cause instanceof Error ? cause.message : "Failed to load this day's log.";
      }
    } finally {
      if (requestId === loadRequestId.value) {
        isLoadingDay.value = false;
      }
    }
  });

  const saveCurrentDay = $(async () => {
    if (!selectedDate.value) return;
    await persistLog(selectedDate.value, input.value);
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
    if (isSaving.value || isLoadingDay.value) return;

    const today = getLocalDateKey(new Date());
    if (trackingToday.value && selectedDate.value !== today) {
      await loadDay(today);
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
        if (trackingToday.value && selectedDate.value === today) {
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
        if (trackingToday.value && selectedDate.value === today) {
          await persistLog(selectedDate.value, updatedLog);
        }
        return;
      }
    }

    const separator = input.value.trim() ? "\n" : "";
    const updatedLog = `${input.value.trimEnd()}${separator}${time}${status}`;
    input.value = updatedLog;
    if (trackingToday.value && selectedDate.value === today) {
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

  return (
    <div class="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6">
        
        {/* Title */}
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            HOS Log Parser
          </h1>
          <p class="text-sm text-gray-500">
            Enter status changes. A timestamp followed by a status starts that status at the given time; spaces are ignored. The day defaults to Off-duty (O).
          </p>
        </div>

        <section class="space-y-3 rounded-xl border border-gray-200 p-4">
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Log day
              <input
                type="date"
                class="rounded-lg border border-gray-300 px-3 py-2"
                value={selectedDate.value}
                disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
                onInput$={(event) =>
                  loadDay((event.target as HTMLInputElement).value)
                }
              />
            </label>
            <button
              type="button"
              class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!storageReady.value || !selectedDate.value || isLoadingDay.value || isSaving.value}
              onClick$={saveCurrentDay}
            >
              {isSaving.value ? "Saving..." : "Save day log"}
            </button>
            {loadedRecord.value && input.value !== loadedRecord.value.logText && (
              <span class="text-sm font-medium text-amber-700">Unsaved changes</span>
            )}
          </div>

          {storageError.value && (
            <p role="alert" class="text-sm text-red-600">
              Local storage error: {storageError.value}
            </p>
          )}
          {storageMessage.value && (
            <p role="status" class="text-sm text-green-700">
              {storageMessage.value}
            </p>
          )}

          <div>
            <h2 class="mb-2 text-sm font-semibold text-gray-700">Saved days on this device</h2>
            {savedLogs.value.length ? (
              <div class="flex flex-wrap gap-2">
                {savedLogs.value.map((record) => (
                  <button
                    key={record.date}
                    type="button"
                    disabled={isLoadingDay.value || isSaving.value}
                    class={`rounded-full border px-3 py-1 text-sm ${
                      selectedDate.value === record.date
                        ? "border-blue-700 bg-blue-50 text-blue-800"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick$={() => loadDay(record.date)}
                  >
                    {new Date(`${record.date}T00:00:00`).toLocaleDateString()}
                  </button>
                ))}
              </div>
            ) : (
              <p class="text-sm text-gray-500">No saved logs yet.</p>
            )}
          </div>
        </section>

        {/* Textarea */}
        <div>
          <textarea
            class="w-full h-48 p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!storageReady.value || isLoadingDay.value || isSaving.value}
            placeholder={`Timestamp + status starts a status at that time:

O
0104D

Or use status + interval end times:

O630N645D900O

or one entry per line:
O630
N645
D900
O`}
            value={input.value}
            onInput$={(e) =>
              (input.value = (e.target as HTMLTextAreaElement).value)
            }
          />
        </div>

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
