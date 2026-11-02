import { component$, $, useComputed$, useSignal } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { HosTimeline } from "./hos-timeline";
import { getLocalDateKey, getMinuteOfDay } from "./date-utils";
import { parseLogs } from "./hos-log-normalizer";
import type { ParseResult } from "./hos-log-normalizer";

interface HosLogProps {
  HosRecord: string;
  disabled?: boolean | undefined;
  onSave?: QRL<(logText: string) => Promise<boolean>>;
}

function tryParse(
  input: string,
): { result: ParseResult; error: null } | { result: null; error: string } {
  try {
    return { result: parseLogs(input), error: null };
  } catch (cause) {
    return {
      result: null,
      error: cause instanceof Error ? cause.message : "Invalid HOS log.",
    };
  }
}

export const HosLog = component$((props: HosLogProps) => {
  const isLogDialogOpen = useSignal(false);
  const editedLog = useSignal("");
  const isSaving = useSignal(false);
  const saveError = useSignal<string | null>(null);

  const parsed = useComputed$(() => tryParse(props.HosRecord));
  const editedParse = useComputed$(() => tryParse(editedLog.value));

  const canEdit = useComputed$(() => !props.disabled && !!props.onSave);
  const date = useComputed$(() => parsed.value.result?.date ?? "");
  const isPastDay = useComputed$(
    () => !!date.value && date.value < getLocalDateKey(new Date()),
  );
  const cutoffMinute = useComputed$(() =>
    date.value && date.value === getLocalDateKey(new Date())
      ? getMinuteOfDay(new Date())
      : 1440,
  );

  const openLogDialog = $(() => {
    editedLog.value = props.HosRecord;
    saveError.value = null;
    isLogDialogOpen.value = true;
  });

  const closeLogDialog = $(() => {
    saveError.value = null;
    isLogDialogOpen.value = false;
  });

  const saveLogEdits = $(async () => {
    if (!props.onSave) return;
    saveError.value = null;
    isSaving.value = true;
    try {
      const saved = await props.onSave(editedLog.value);
      if (saved) {
        isLogDialogOpen.value = false;
      } else {
        saveError.value = "The log could not be saved. Please try again.";
      }
    } catch (cause) {
      saveError.value =
        cause instanceof Error
          ? `The log could not be saved: ${cause.message}`
          : "The log could not be saved. Please try again.";
    } finally {
      isSaving.value = false;
    }
  });

  const dialogError = editedParse.value.error ?? saveError.value;

  return (
    <>
      <section class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Log date
            </p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              {date.value
                ? new Date(`${date.value}T00:00:00`).toLocaleDateString()
                : "Unknown date"}
            </h2>
          </div>
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.disabled}
            onClick$={openLogDialog}
          >
            {canEdit.value ? "Edit raw log" : "View raw log"}
          </button>
        </div>
        <p class="text-xs leading-5 text-slate-500">
          {isPastDay.value
            ? "Remaining time is counted as Off-duty."
            : "The breakdown shows elapsed time until the day is over."}
        </p>
      </section>

      {parsed.value.error && (
        <p
          role="alert"
          class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {parsed.value.error}
        </p>
      )}

      {parsed.value.result && (
        <div>
          <h2 class="mb-3 text-base font-semibold text-slate-900">Breakdown</h2>
          <HosTimeline
            entries={parsed.value.result.value}
            cutoffMinute={cutoffMinute.value}
            onSave={canEdit.value ? props.onSave : undefined}
          />
        </div>
      )}

      {isLogDialogOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <section
            class="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hos-log-dialog-title"
          >
            <h2
              id="hos-log-dialog-title"
              class="text-xl font-bold tracking-tight text-slate-900"
            >
              {canEdit.value ? "Edit raw log" : "View raw log"}
            </h2>
            <label
              for="hos-log-text"
              class="mb-2 mt-5 block text-sm font-semibold text-slate-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="hos-log-text"
              class="h-64 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              readOnly={!canEdit.value}
              value={editedLog.value}
              onInput$={(event) => {
                editedLog.value = (event.target as HTMLTextAreaElement).value;
                saveError.value = null;
              }}
            />
            {canEdit.value && dialogError && (
              <p
                role="alert"
                class="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {dialogError}
              </p>
            )}
            <footer class="mt-5 flex justify-end gap-3">
              {canEdit.value ? (
                <>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={isSaving.value}
                    onClick$={closeLogDialog}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSaving.value ||
                      !!editedParse.value.error ||
                      editedLog.value === props.HosRecord
                    }
                    onClick$={saveLogEdits}
                  >
                    {isSaving.value ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick$={closeLogDialog}
                >
                  Close
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
});
