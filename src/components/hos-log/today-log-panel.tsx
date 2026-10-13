import { component$ } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { DurationBreakdown } from "./duration-breakdown";
import type { HosLogRecord } from "~/libs/hos-log-storage";
import type { StatusDuration } from "~/models/duty-status";

interface TodayLogPanelProps {
  date: string;
  input: string;
  calculatedDuration: StatusDuration;
  error: string | null;
  storageError: string | null;
  storageMessage: string | null;
  loadedRecord: HosLogRecord | null;
  historyOpen: boolean;
  storageReady: boolean;
  isLoadingDay: boolean;
  isSaving: boolean;
  onOpenHistory: QRL<() => void>;
  onSaveCurrentDay: QRL<() => void>;
  onInput: QRL<(event: Event) => void>;
  onAddStatus: QRL<(status: "O" | "D" | "N") => Promise<void>>;
}

export const TodayLogPanel = component$((props: TodayLogPanelProps) => {
  const isDisabled =
    !props.storageReady || props.isLoadingDay || props.isSaving;

  return (
    <div
      class="w-full max-w-3xl space-y-6 rounded-2xl bg-white p-6 shadow-lg"
      aria-hidden={props.historyOpen}
      inert={props.historyOpen}
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-800">HOS Log Parser</h1>
        <p class="text-sm text-gray-500">
          Enter status changes. A timestamp followed by a status starts that
          status at the given time; spaces are ignored. The day defaults to
          Off-duty (O).
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
          {props.loadedRecord && props.input !== props.loadedRecord.logText && (
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
            class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !props.storageReady ||
              !props.date ||
              props.isLoadingDay ||
              props.isSaving
            }
            onClick$={props.onSaveCurrentDay}
          >
            {props.isSaving ? "Saving..." : "Save today"}
          </button>
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

      <div>
        <label
          for="hos-log"
          class="mb-2 block text-sm font-semibold text-gray-700"
        >
          Daily HOS log
        </label>
        <textarea
          id="hos-log"
          class="h-48 w-full rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isDisabled}
          value={props.input}
          onInput$={props.onInput}
        />
      </div>

      {!props.historyOpen && (
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            disabled={isDisabled}
            onClick$={() => props.onAddStatus("O")}
          >
            Off-duty
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            disabled={isDisabled}
            onClick$={() => props.onAddStatus("D")}
          >
            Driving
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            disabled={isDisabled}
            onClick$={() => props.onAddStatus("N")}
          >
            On-duty not driving
          </button>
        </div>
      )}

      <div class="flex min-h-6 items-center justify-between">
        {props.error && (
          <span class="text-sm text-red-500">{props.error}</span>
        )}
      </div>

      <div>
        <h2 class="mb-2 text-lg font-semibold text-gray-700">Parsed Output</h2>
        <DurationBreakdown duration={props.calculatedDuration} />
      </div>
    </div>
  );
});
