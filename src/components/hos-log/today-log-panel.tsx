import { component$, $, useSignal } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { DurationBreakdown } from "./duration-breakdown";
import type { HosLogRecord } from "~/libs/hos-log-storage";
import type { DutyEntry } from "~/models/duty-entry";
import type { DutyStatus } from "~/models/duty-status";
import type { StatusDuration } from "~/models/duty-status";
import type { StatusKey } from "~/models/duty-status";

const CURRENT_STATUS_LABEL: Record<DutyStatus, string> = {
  OFF_DUTY: "off-duty",
  SLEEPER: "sleeper",
  DRIVING: "driving",
  ON_DUTY_NOT_DRIVING: "on-duty not driving",
};

const DUTY_STATUS_KEY: Partial<Record<DutyStatus, StatusKey>> = {
  OFF_DUTY: "O",
  DRIVING: "D",
  ON_DUTY_NOT_DRIVING: "N",
};

function getStatusKey(entry?: DutyEntry): StatusKey | undefined {
  return entry ? DUTY_STATUS_KEY[entry.status] : undefined;
}

function getStatusButtonClass(
  status: StatusKey,
  currentDutyEntry?: DutyEntry,
): string {
  const base =
    "rounded-lg px-4 py-2 text-sm font-semibold text-white ring-offset-2";
  const active = getStatusKey(currentDutyEntry) === status;
  const styles: Record<StatusKey, string> = {
    O: "bg-gray-600 hover:bg-gray-700",
    S: "bg-purple-600 hover:bg-purple-700",
    D: "bg-blue-600 hover:bg-blue-700",
    N: "bg-amber-600 hover:bg-amber-700",
  };
  return `${base} ${styles[status]}${active ? " ring-4 ring-blue-300" : ""}`;
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
  onAddStatus: QRL<(status: "O" | "D" | "N") => Promise<void>>;
  onSetDayComplete: QRL<(completed: boolean) => Promise<boolean | void>>;
}

export const TodayLogPanel = component$((props: TodayLogPanelProps) => {
  const isEditingLog = useSignal(false);
  const editedLog = useSignal("");
  const isDisabled =
    !props.storageReady || props.isLoadingDay || props.isSaving;
  const isStatusDisabled = isDisabled || props.isDayComplete;

  const openLogEditor = $(() => {
    editedLog.value = props.input;
    isEditingLog.value = true;
  });

  const discardLogEdits = $(() => {
    isEditingLog.value = false;
  });

  const saveLogEdits = $(async () => {
    const saved = await props.onSaveLog(editedLog.value);
    if (saved) isEditingLog.value = false;
  });

  return (
    <>
      <div
        class="w-full max-w-3xl space-y-6 rounded-2xl bg-white p-6 shadow-lg"
        aria-hidden={props.historyOpen || isEditingLog.value}
        inert={props.historyOpen || isEditingLog.value}
      >
        <div>
          <h1 class="text-2xl font-bold text-gray-800">HOS Log Parser</h1>
          <p class="text-sm text-gray-500">
            A status followed by a time ends that interval. A final status
            without a time is temporary; unassigned time is Off-duty (O).
          </p>
        </div>

        <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
          <div>
            <h2 class="text-sm font-semibold text-gray-700">Today</h2>
            <p class="text-sm text-gray-500">
              {new Date(`${props.date}T00:00:00`).toLocaleDateString()}
            </p>
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
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isDisabled}
              onClick$={props.onOpenHistory}
            >
              View past logs
            </button>
            <button
              type="button"
              class="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50"
              disabled={
                isDisabled || props.date !== getLocalDateKey(new Date())
              }
              onClick$={() => props.onSetDayComplete(!props.isDayComplete)}
            >
              {props.isDayComplete ? "Reopen day" : "Mark day complete"}
            </button>
            <p class="w-full text-xs text-gray-500">
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

        {props.date === getLocalDateKey(new Date()) &&
          props.currentDutyEntry && (
            <p
              class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"
              aria-live="polite"
            >
              You are currently{" "}
              <strong>
                {CURRENT_STATUS_LABEL[props.currentDutyEntry.status]}
              </strong>{" "}
              since <strong>{props.currentDutyEntry.startTime}</strong>.
            </p>
          )}

        <div>
          <button
            type="button"
            class="text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
            disabled={isStatusDisabled}
            onClick$={openLogEditor}
          >
            Edit log
          </button>
        </div>

        {!props.historyOpen && (
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class={getStatusButtonClass("O", props.currentDutyEntry)}
              aria-pressed={getStatusKey(props.currentDutyEntry) === "O"}
              disabled={isStatusDisabled}
              onClick$={() => props.onAddStatus("O")}
            >
              Off-duty
              {getStatusKey(props.currentDutyEntry) === "O" && (
                <span class="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  Current
                </span>
              )}
            </button>
            <button
              type="button"
              class={getStatusButtonClass("D", props.currentDutyEntry)}
              aria-pressed={getStatusKey(props.currentDutyEntry) === "D"}
              disabled={isStatusDisabled}
              onClick$={() => props.onAddStatus("D")}
            >
              Driving
              {getStatusKey(props.currentDutyEntry) === "D" && (
                <span class="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  Current
                </span>
              )}
            </button>
            <button
              type="button"
              class={getStatusButtonClass("N", props.currentDutyEntry)}
              aria-pressed={getStatusKey(props.currentDutyEntry) === "N"}
              disabled={isStatusDisabled}
              onClick$={() => props.onAddStatus("N")}
            >
              On-duty not driving
              {getStatusKey(props.currentDutyEntry) === "N" && (
                <span class="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  Current
                </span>
              )}
            </button>
          </div>
        )}

        <div class="flex min-h-6 items-center justify-between">
          {props.error && (
            <span class="text-sm text-red-500">{props.error}</span>
          )}
        </div>

        <div>
          <h2 class="mb-2 text-lg font-semibold text-gray-700">
            Parsed Output
          </h2>
          <DurationBreakdown duration={props.calculatedDuration} />
        </div>
      </div>

      {isEditingLog.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <section
            class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-log-dialog-title"
          >
            <h2
              id="today-log-dialog-title"
              class="text-lg font-semibold text-gray-800"
            >
              Edit today’s log
            </h2>
            <label
              for="hos-log"
              class="mb-2 mt-4 block text-sm font-semibold text-gray-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="hos-log"
              class="h-56 w-full rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              disabled={isDisabled}
              value={editedLog.value}
              onInput$={(event) => {
                editedLog.value = (event.target as HTMLTextAreaElement).value;
              }}
            />
            {(props.error || props.storageError) && (
              <p role="alert" class="mt-2 text-sm text-red-600">
                {props.error || props.storageError}
              </p>
            )}
            <footer class="mt-5 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={props.isSaving}
                onClick$={discardLogEdits}
              >
                Discard
              </button>
              <button
                type="button"
                class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isDisabled || editedLog.value === props.input}
                onClick$={saveLogEdits}
              >
                {props.isSaving ? "Saving..." : "Save"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
});
