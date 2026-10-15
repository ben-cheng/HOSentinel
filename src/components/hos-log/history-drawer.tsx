import { component$, $, useSignal } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { DurationBreakdown } from "./duration-breakdown";
import type { HosLogRecord } from "~/libs/hos-log-storage";
import type { StatusDuration } from "~/models/duty-status";

interface HistoryDrawerProps {
  date: string;
  today: string;
  input: string;
  duration: StatusDuration;
  error: string | null;
  storageError: string | null;
  savedLogs: HosLogRecord[];
  isLoading: boolean;
  isSaving: boolean;
  onSelectDay: QRL<(date: string) => void>;
  onInput: QRL<(logText: string) => void>;
  onSave: QRL<(logText: string) => Promise<boolean>>;
  onDiscard: QRL<() => void>;
}

export const HistoryDrawer = component$((props: HistoryDrawerProps) => {
  const isLogDialogOpen = useSignal(false);
  const editedLog = useSignal("");
  const baselineLog = useSignal("");
  const saveError = useSignal<string | null>(null);
  const historicalLogs = props.savedLogs.filter(
    (record) => record.date < props.today,
  );
  const isBusy = props.isLoading || props.isSaving;

  const openLogDialog = $(() => {
    editedLog.value = props.input;
    baselineLog.value = props.input;
    saveError.value = null;
    isLogDialogOpen.value = true;
  });

  const discardLogEdits = $(() => {
    props.onInput(baselineLog.value);
    saveError.value = null;
    isLogDialogOpen.value = false;
  });

  const saveLogEdits = $(async () => {
    saveError.value = null;
    try {
      const saved = await props.onSave(editedLog.value);
      if (saved) {
        baselineLog.value = editedLog.value;
        isLogDialogOpen.value = false;
      } else if (!props.error && !props.storageError) {
        saveError.value = "The log could not be saved. Please try again.";
      }
    } catch (cause) {
      saveError.value =
        cause instanceof Error
          ? `The log could not be saved: ${cause.message}`
          : "The log could not be saved. Please try again.";
    }
  });

  return (
    <div class="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        class="absolute inset-0 bg-black/20"
        aria-label="Close historical logs"
        onClick$={props.onDiscard}
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
              {props.date
                ? new Date(`${props.date}T00:00:00`).toLocaleDateString()
                : "Select a day"}
            </h2>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close historical logs"
            onClick$={props.onDiscard}
          >
            &times;
          </button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto p-5">
          <label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-gray-700">
            Select historical day
            <input
              type="date"
              max={props.today}
              class="rounded-lg border border-gray-300 px-3 py-2"
              value={props.date}
              disabled={isBusy}
              onInput$={(event) => {
                const date = (event.target as HTMLInputElement).value;
                if (date) props.onSelectDay(date);
              }}
            />
          </label>

          <div>
            <h3 class="mb-2 text-sm font-semibold text-gray-700">
              Saved historical days
            </h3>
            {historicalLogs.length > 0 ? (
              <div class="flex flex-wrap gap-2">
                {historicalLogs.map((record) => (
                  <button
                    key={record.date}
                    type="button"
                    disabled={isBusy}
                    class={`rounded-full border px-3 py-1 text-sm ${
                      props.date === record.date
                        ? "border-blue-700 bg-blue-50 text-blue-800"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick$={() => props.onSelectDay(record.date)}
                  >
                    {new Date(`${record.date}T00:00:00`).toLocaleDateString()}
                  </button>
                ))}
              </div>
            ) : (
              <p class="text-sm text-gray-500">No saved historical logs yet.</p>
            )}
          </div>

          {props.storageError && (
            <p role="alert" class="text-sm text-red-600">
              Local storage error: {props.storageError}
            </p>
          )}

          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isBusy || !props.date}
            onClick$={openLogDialog}
          >
            Edit log
          </button>

          <DurationBreakdown duration={props.duration} variant="section" />
        </div>

        <footer class="flex justify-end border-t border-gray-200 p-5">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick$={props.onDiscard}
          >
            Close
          </button>
        </footer>
      </aside>

      {isLogDialogOpen.value && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <section
            class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historical-log-dialog-title"
          >
            <h2
              id="historical-log-dialog-title"
              class="text-lg font-semibold text-gray-800"
            >
              Edit log for{" "}
              {new Date(`${props.date}T00:00:00`).toLocaleDateString()}
            </h2>
            {(props.error || props.storageError || saveError.value) && (
              <p role="alert" class="mt-2 text-sm text-red-600">
                {props.error ||
                  (props.storageError
                    ? `Local storage error: ${props.storageError}`
                    : saveError.value)}
              </p>
            )}
            <label
              for="historical-hos-log-view"
              class="mb-2 mt-4 block text-sm font-semibold text-gray-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="historical-hos-log-view"
              class="h-56 w-full rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              disabled={props.isSaving}
              value={editedLog.value}
              onInput$={(event) => {
                editedLog.value = (event.target as HTMLTextAreaElement).value;
                props.onInput(editedLog.value);
                saveError.value = null;
              }}
            />
            <footer class="mt-5 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={props.isSaving}
                onClick$={discardLogEdits}
              >
                Discard
              </button>
              <button
                type="button"
                class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  props.isSaving ||
                  editedLog.value === baselineLog.value ||
                  Boolean(props.error)
                }
                onClick$={saveLogEdits}
              >
                {props.isSaving ? "Saving..." : "Save changes"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
});
