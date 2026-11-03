import { component$, $, useComputed$, useSignal } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { HosTimeline } from "./hos-timeline";
import { STATUS_OPTIONS, StatusPanel } from "./status-panel";
import type { SelectableStatusKey } from "./status-panel";
import type { HosLogRecord } from "~/components/hos-log/hos-log-storage";
import type {
  DutyEntry,
} from "~/components/hos-log/hours-of-service";
import {
  getCurrentStatus,
} from "~/components/hos-log/hours-of-service";


function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTimelineCutoff(
  date: string,
  isDayComplete: boolean,
  nowMs: number,
): number {
  const now = new Date(nowMs);
  return date === getLocalDateKey(now) && !isDayComplete
    ? now.getHours() * 60 + now.getMinutes()
    : 1440;
}

interface TodayLogPanelProps {
  /** Epoch ms, supplied by the caller so the panel stays pure. */
  now: number;
  date: string;
  input: string;
  currentDutyEntry?: DutyEntry;
  entries: DutyEntry[];
  error: string | null;
  storageError: string | null;
  storageMessage: string | null;
  loadedRecord: HosLogRecord | null;
  isDayComplete: boolean;
  storageReady: boolean;
  isLoadingDay: boolean;
  isSaving: boolean;
  onOpenHistory: QRL<() => void>;
  onSaveLog: QRL<(logText: string) => Promise<boolean>>;
  onAddStatus: QRL<(status: SelectableStatusKey) => Promise<void>>;
  onSetDayComplete: QRL<(completed: boolean) => Promise<boolean | void>>;
}

export const TodayLogPanel = component$((props: TodayLogPanelProps) => {
  const isLogDialogOpen = useSignal(false);
  const editedLog = useSignal("");
  const saveError = useSignal<string | null>(null);
  const isDisabled = useComputed$(
    () => !props.storageReady || props.isLoadingDay || props.isSaving,
  );
  const isReadOnly = useComputed$(
    () => props.isDayComplete || props.date < getLocalDateKey(new Date(props.now)),
  );
  const isStatusDisabled = useComputed$(
    () => isDisabled.value || isReadOnly.value,
  );

  const currentStatus = useComputed$(() => getCurrentStatus(props.currentDutyEntry));

  const openLogDialog = $(() => {
    editedLog.value = props.input;
    saveError.value = null;
    isLogDialogOpen.value = true;
  });

  const closeLogDialog = $(() => {
    saveError.value = null;
    isLogDialogOpen.value = false;
  });

  const saveLogEdits = $(async () => {
    saveError.value = null;
    try {
      const saved = await props.onSaveLog(editedLog.value);
      if (saved) {
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
        <section class="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div class="flex flex-wrap justify-between gap-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
                Selected day
              </p>
              <h2 class="mt-1 text-lg font-semibold text-slate-900">
                {new Date(`${props.date}T00:00:00`).toLocaleDateString()}
              </h2>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="min-h-6 text-sm font-medium text-amber-700">
                {props.loadedRecord &&
                  props.input !== props.loadedRecord.logText && (
                    <>Unsaved changes</>
                  )}
              </span>
              <button
                type="button"
                class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isDisabled.value}
                onClick$={props.onOpenHistory}
              >
                View past logs
              </button>
              <button
                type="button"
                class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50"
                disabled={
                  isDisabled.value || props.date !== getLocalDateKey(new Date(props.now))
                }
                onClick$={() => props.onSetDayComplete(!props.isDayComplete)}
              >
                {props.isDayComplete ? "Reopen day" : "Mark day complete"}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="w-full text-xs leading-5 text-slate-500">
              {props.isDayComplete
                ? "Remaining time is counted as Off-duty."
                : "The breakdown shows elapsed time until you mark the day complete."}
            </p>
          </div>
          <div class="w-full space-y-2">
            {props.storageError && (
              <p role="alert" class="text-sm text-red-600">
                Local storage error: {props.storageError}
              </p>
            )}
            {!props.storageError && props.storageMessage && (
              <p role="status" class="text-sm text-green-700">
                {props.storageMessage}
              </p>
            )}
            {!props.storageError && !props.storageMessage && (
              <div class="h-6"></div>
            )}
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-slate-900">
                Duty status
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Select your current activity to record a status change.
              </p>
            </div>
            <button
              type="button"
              class="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
              disabled={isDisabled.value}
              onClick$={openLogDialog}
            >
              {isReadOnly.value ? "View raw log" : "Edit raw log"}
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2 sm:gap-3">
            {STATUS_OPTIONS.map(({ status, label }) => (
              <StatusPanel
                key={status}
                status={status}
                label={label}
                currentStatus={currentStatus.value}
                currentSince={props.currentDutyEntry?.startTime}
                disabled={isStatusDisabled.value}
                onAddStatus={props.onAddStatus}
              />
            ))}
          </div>
        </section>

        <div>
          <h2 class="mb-3 text-base font-semibold text-slate-900">
            Today’s breakdown
          </h2>
          <div>
            <HosTimeline
              entries={props.entries}
              cutoffMinute={getTimelineCutoff(props.date, props.isDayComplete, props.now)}
              onSave={isDisabled.value ? undefined : props.onSaveLog}
            />
          </div>
        </div>

      <div class="flex min-h-6 items-center justify-between">
        {props.error && (
          <span class="text-sm text-red-500">{props.error}</span>
        )}
      </div>

      {isLogDialogOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <section
            class="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-log-dialog-title"
          >
            <h2
              id="today-log-dialog-title"
              class="text-xl font-bold tracking-tight text-slate-900"
            >
              {isReadOnly.value ? "View raw log" : "Edit raw log"}
            </h2>
            <label
              for="hos-log"
              class="mb-2 mt-5 block text-sm font-semibold text-slate-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="hos-log"
              class="h-64 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              readOnly={isReadOnly.value}
              value={editedLog.value}
              onInput$={(event) => {
                editedLog.value = (event.target as HTMLTextAreaElement).value;
                saveError.value = null;
              }}
            />
            {(props.error || props.storageError || saveError.value) && (
              <p
                role="alert"
                class="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {props.error ||
                  (props.storageError
                    ? `Local storage error: ${props.storageError}`
                    : saveError.value)}
              </p>
            )}
            <footer class="mt-5 flex justify-end gap-3">
              {isReadOnly.value ? (
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick$={closeLogDialog}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={props.isSaving}
                    onClick$={closeLogDialog}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isDisabled.value || editedLog.value === props.input
                    }
                    onClick$={saveLogEdits}
                  >
                    {props.isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
});
