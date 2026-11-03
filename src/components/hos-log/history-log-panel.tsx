import { component$, $, useComputed$, useSignal } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { HosTimeline } from "./hos-timeline";
import type { HosLogRecord } from "~/components/hos-log/hos-log-storage";

interface HistoryLogPanelProps {
  date: string;
  maxDate: string;
  input: string;
  error: string | null;
  storageError: string | null;
  savedLogs: HosLogRecord[];
  isLoading: boolean;
  isSaving: boolean;
  onSelectDay: QRL<(date: string) => void>;
  onInput: QRL<(logText: string) => void>;
  onSave: QRL<(logText: string) => Promise<boolean>>;
}

export const HistoryLogPanel = component$((props: HistoryLogPanelProps) => {
  const isLogDialogOpen = useSignal(false);
  const editedLog = useSignal("");
  const baselineLog = useSignal("");
  const saveError = useSignal<string | null>(null);
  const historicalLogs = useComputed$(() =>
    props.savedLogs.filter((record) => record.date <= props.maxDate),
  );
  const isBusy = useComputed$(() => props.isLoading || props.isSaving);

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
    <>
      <div class="space-y-6">
        <label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-gray-700">
          Select historical day
          <input
            type="date"
            max={props.maxDate}
            class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            value={props.date}
            disabled={isBusy.value}
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
          {historicalLogs.value.length > 0 ? (
            <div class="flex flex-wrap gap-2">
              {historicalLogs.value.map((record) => (
                <button
                  key={record.date}
                  type="button"
                  disabled={isBusy.value}
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
          disabled={isBusy.value || !props.date}
          onClick$={openLogDialog}
        >
          Edit raw log
        </button>

        <HosTimeline
          log={props.input}
        />
      </div>

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
              Edit raw log for{" "}
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
    </>
  );
});
