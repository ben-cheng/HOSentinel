import { component$, $, useSignal } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { DurationBreakdown } from "./duration-breakdown";
import type { HosLogRecord } from "~/components/hos-log/hos-log-storage";
import type { StatusDuration } from "~/components/hos-log/hours-of-service";

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
        class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        aria-label="Close historical logs"
        onClick$={props.onDiscard}
      />
      <aside
        class="relative flex h-full w-full max-w-xl animate-[history-slide-in_250ms_ease-out] flex-col border-l border-slate-200 bg-white shadow-2xl"
        aria-label="Historical HOS log"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 p-6">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Historical record
            </p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {props.date
                ? new Date(`${props.date}T00:00:00`).toLocaleDateString()
                : "Select a day"}
            </h2>
          </div>
          <button
            type="button"
            class="rounded-xl p-2 text-2xl leading-none text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="Close historical logs"
            onClick$={props.onDiscard}
          >
            &times;
          </button>
        </header>

        <div class="flex-1 space-y-6 overflow-y-auto p-6">
          <label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-gray-700">
            Select historical day
            <input
              type="date"
              max={props.today}
              class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
                    class={`rounded-full border px-3 py-1.5 text-sm transition ${
                      props.date === record.date
                        ? "border-blue-200 bg-blue-50 font-semibold text-blue-800"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            disabled={isBusy || !props.date}
            onClick$={openLogDialog}
          >
            Edit log
          </button>

          <DurationBreakdown duration={props.duration} variant="section" />
        </div>

        <footer class="flex justify-end border-t border-slate-100 bg-slate-50/70 p-5">
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick$={props.onDiscard}
          >
            Close
          </button>
        </footer>
      </aside>

      {isLogDialogOpen.value && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <section
            class="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="historical-log-dialog-title"
          >
            <h2
              id="historical-log-dialog-title"
              class="text-xl font-bold tracking-tight text-slate-900"
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
              class="mb-2 mt-5 block text-sm font-semibold text-slate-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="historical-hos-log-view"
              class="h-56 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
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
                class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                disabled={props.isSaving}
                onClick$={discardLogEdits}
              >
                Discard
              </button>
              <button
                type="button"
                class="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
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
