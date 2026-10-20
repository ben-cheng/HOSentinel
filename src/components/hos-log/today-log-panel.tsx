import { component$, $, useComputed$, useSignal } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { DurationBreakdown } from "./duration-breakdown";
import { STATUS_OPTIONS, StatusPanel } from "./status-panel";
import type { SelectableStatusKey } from "./status-panel";
import type { HosLogRecord } from "~/components/hos-log/hos-log-storage";
import type {
  DutyEntry,
  DutyStatus,
  StatusKey,
  StatusDuration,
} from "~/components/hos-log/hours-of-service";

const DUTY_STATUS_KEY: Partial<Record<DutyStatus, StatusKey>> = {
  OFF_DUTY: "O",
  DRIVING: "D",
  ON_DUTY_NOT_DRIVING: "N",
};

function getCurrentStatus(entry?: DutyEntry): StatusKey | undefined {
  return entry ? DUTY_STATUS_KEY[entry.status] : undefined;
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface TodayLogPanelProps {
  date: string;
  input: string;
  currentDutyEntry?: DutyEntry;
  calculatedDuration: StatusDuration;
  error: string | null;
  storageError: string | null;
  storageMessage: string | null;
  loadedRecord: HosLogRecord | null;
  isDayComplete: boolean;
  historyOpen: boolean;
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
    () => props.isDayComplete || props.date < getLocalDateKey(new Date()),
  );
  const isStatusDisabled = useComputed$(
    () => isDisabled.value || isReadOnly.value,
  );

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
      <div
        class="mx-auto w-full max-w-4xl space-y-8 rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-300/50 sm:p-8"
        aria-hidden={props.historyOpen || isLogDialogOpen.value}
        inert={props.historyOpen || isLogDialogOpen.value}
      >
        <div class="border-b border-slate-100 pb-6">
          <p class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            HOSentinel · Daily log
          </p>
          <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Hours of Service
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A status followed by a time ends that interval. A final status
            without a time is temporary; unassigned time is Off-duty (O).
          </p>
        </div>

        <section class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Selected day
            </p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">
              {new Date(`${props.date}T00:00:00`).toLocaleDateString()}
            </h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            {props.loadedRecord &&
              props.input !== props.loadedRecord.logText && (
                <span class="text-sm font-medium text-amber-700">
                  Unsaved changes
                </span>
              )}
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
                isDisabled.value || props.date !== getLocalDateKey(new Date())
              }
              onClick$={() => props.onSetDayComplete(!props.isDayComplete)}
            >
              {props.isDayComplete ? "Reopen day" : "Mark day complete"}
            </button>
            <p class="w-full text-xs leading-5 text-slate-500">
              {props.isDayComplete
                ? "Remaining time is counted as Off-duty."
                : "The breakdown shows elapsed time until you mark the day complete."}
            </p>
          </div>
          {props.storageError && (
            <p role="alert" class="w-full text-sm text-red-600">
              Local storage error: {props.storageError}
            </p>
          )}
          {props.storageMessage && (
            <p role="status" class="w-full text-sm text-green-700">
              {props.storageMessage}
            </p>
          )}
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
              {isReadOnly.value ? "View log" : "Edit log"}
            </button>
          </div>

          {!props.historyOpen && (
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              {STATUS_OPTIONS.map(({ status, label }) => (
                <StatusPanel
                  key={status}
                  status={status}
                  label={label}
                  currentStatus={getCurrentStatus(props.currentDutyEntry)}
                  currentSince={props.currentDutyEntry?.startTime}
                  disabled={isStatusDisabled.value}
                  onAddStatus={props.onAddStatus}
                />
              ))}
            </div>
          )}
        </section>

        <div class="flex min-h-6 items-center justify-between">
          {props.error && (
            <span class="text-sm text-red-500">{props.error}</span>
          )}
        </div>

        <div>
          <h2 class="mb-3 text-base font-semibold text-slate-900">
            Today’s breakdown
          </h2>
          <DurationBreakdown duration={props.calculatedDuration} />
        </div>
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
              {isReadOnly.value ? "View log" : "Edit log"}
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
