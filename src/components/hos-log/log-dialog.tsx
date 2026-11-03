import { component$, useSignal, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { LogEditForm } from "./log-edit-form";

interface LogDialogProps {
  title: string;
  /** Raw log text. */
  log: string;
  mode: "read" | "edit";
  isToday?: boolean;
  cutoffMinute?: number;
  /** Resolves to true when the log was saved and the dialog may close. */
  onSave$?: QRL<(log: string) => Promise<boolean>>;
  onClose$: QRL<() => void>;
}

export const LogDialog = component$((props: LogDialogProps) => {
  const saveError = useSignal<string | null>(null);

  const save = $(async (log: string) => {
    saveError.value = null;
    try {
      const saved = await props.onSave$?.(log);
      if (saved) await props.onClose$();
      else saveError.value = "The log could not be saved. Please try again.";
    } catch (cause) {
      saveError.value =
        cause instanceof Error ? cause.message : "The log could not be saved.";
    }
  });

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <section
        class="flex max-h-full w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <div class="mb-3 flex shrink-0 items-center justify-between">
          <h2 class="text-xl font-bold tracking-tight text-slate-900">
            {props.title}
          </h2>
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick$={props.onClose$}
          >
            {props.mode === "read" ? "Close" : "Cancel"}
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          <LogEditForm
            log={props.log}
            mode={props.mode}
            isToday={props.isToday}
            cutoffMinute={props.cutoffMinute}
            onSave$={save}
          />
        </div>
        {saveError.value && (
          <p role="alert" class="mt-2 text-sm text-red-700">
            {saveError.value}
          </p>
        )}
      </section>
    </div>
  );
});
