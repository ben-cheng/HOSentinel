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
    <div class="space-y-5">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          Today log
        </h2>
        <p class="mt-1 text-sm text-slate-600">
          Track your duty status and review today&apos;s timeline.
        </p>
      </div>

      <section class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
            Today
          </p>
          <h3 class="mt-1 text-lg font-semibold text-slate-900">
            {props.date
              ? new Date(`${props.date}T00:00:00`).toLocaleDateString()
              : ""}
          </h3>
        </div>
        <button
          type="button"
          class="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={props.disabled || !isCurrentDay.value}
          onClick$={() => props.onSetComplete$(!props.isComplete)}
        >
          {props.isComplete ? "Reopen day" : "Close day"}
        </button>
        <p class="w-full text-sm text-slate-600">
          {props.isComplete
            ? "The day is closed. Remaining time is counted as Off-duty."
            : "Closing the day counts the remaining time as Off-duty."}
        </p>
      </section>

      <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Duty status</h3>
          <p class="mt-1 text-sm text-slate-600">
            Select a status to update your current log.
          </p>
        </div>
        <StatusSwitcher
          log={props.log}
          now={props.now}
          disabled={props.disabled || locked.value}
          onChange$={props.onChange$}
        />
      </section>

      <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">Timeline</h3>
            <p class="mt-1 text-sm text-slate-600">
              Select the timeline to view it in detail.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={props.disabled}
              onClick$={() => {
                dialog.value = "read";
              }}
            >
              Details
            </button>
            <button
              type="button"
              class="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
});
