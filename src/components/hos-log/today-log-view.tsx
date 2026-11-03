import { component$, useComputed$, useSignal, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { HosTimeline } from "./hos-timeline";
import { LogDialog } from "./log-dialog";
import { StatusSwitcher } from "./status-switcher";
import { getLocalDateKey, getMinuteOfDay } from "./date-utils";

interface TodayLogViewProps {
  /** Epoch ms, supplied by the caller so the view stays pure. */
  now: number;
  date: string;
  /** Raw log text of the day. */
  log: string;
  isComplete: boolean;
  disabled: boolean;
  error: string | null;
  storageError: string | null;
  storageMessage: string | null;
  onChange$: QRL<(log: string) => void>;
  onSave$: QRL<(log: string) => Promise<boolean>>;
  onSetComplete$: QRL<(completed: boolean) => Promise<boolean | void>>;
}

export const TodayLogView = component$((props: TodayLogViewProps) => {
  const dialog = useSignal<"read" | "edit" | null>(null);
  const closeDialog = $(() => {
    dialog.value = null;
  });

  const isCurrentDay = useComputed$(
    () => props.date === getLocalDateKey(new Date(props.now)),
  );
  const cutoffMinute = useComputed$(() =>
    isCurrentDay.value && !props.isComplete
      ? getMinuteOfDay(new Date(props.now))
      : 1440,
  );
  const locked = useComputed$(() => props.isComplete || !isCurrentDay.value);

  return (
    <>
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Today
          </p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900">
            {props.date
              ? new Date(`${props.date}T00:00:00`).toLocaleDateString()
              : ""}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:opacity-50"
          disabled={props.disabled || !isCurrentDay.value}
          onClick$={() => props.onSetComplete$(!props.isComplete)}
        >
          {props.isComplete ? "Reopen day" : "Close day"}
        </button>
        <p class="w-full text-xs text-slate-500">
          {props.isComplete
            ? "The day is closed. Remaining time is counted as Off-duty."
            : "Closing the day counts the remaining time as Off-duty."}
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-base font-semibold text-slate-900">Duty status</h2>
        <StatusSwitcher
          log={props.log}
          now={props.now}
          disabled={props.disabled || locked.value}
          onChange$={props.onChange$}
        />
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-slate-900">Timeline</h2>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={props.disabled}
              onClick$={() => {
                dialog.value = "read";
              }}
            >
              Details
            </button>
            <button
              type="button"
              class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              disabled={props.disabled}
              onClick$={() => {
                dialog.value = "edit";
              }}
            >
              Edit log
            </button>
          </div>
        </div>
        <HosTimeline log={props.log} cutoffMinute={cutoffMinute.value} />
      </section>

      <div class="min-h-6 text-sm" aria-live="polite">
        {props.error && <p class="text-red-600">{props.error}</p>}
        {props.storageError && (
          <p role="alert" class="text-red-600">
            Local storage error: {props.storageError}
          </p>
        )}
        {!props.storageError && props.storageMessage && (
          <p role="status" class="text-green-700">
            {props.storageMessage}
          </p>
        )}
      </div>

      {dialog.value && (
        <LogDialog
          title="Today's log"
          log={props.log}
          mode={dialog.value}
          isToday={isCurrentDay.value}
          cutoffMinute={cutoffMinute.value}
          onSave$={props.onSave$}
          onClose$={closeDialog}
        />
      )}
    </>
  );
});
