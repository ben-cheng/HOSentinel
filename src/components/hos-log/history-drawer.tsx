import { component$ } from "@builder.io/qwik";
import type { QRL } from "@builder.io/qwik";
import { DurationBreakdown } from "./duration-breakdown";
import type { HosLogRecord } from "~/libs/hos-log-storage";
import type { StatusDuration } from "~/models/duty-status";

interface HistoryDrawerProps {
  date: string;
  today: string;
  input: string;
  baseline: string;
  duration: StatusDuration;
  error: string | null;
  storageError: string | null;
  savedLogs: HosLogRecord[];
  isLoading: boolean;
  isSaving: boolean;
  onSelectDay: QRL<(date: string) => void>;
  onInput: QRL<(event: Event) => void>;
  onDiscard: QRL<() => void>;
  onSave: QRL<() => void>;
}

export const HistoryDrawer = component$((props: HistoryDrawerProps) => {
  const historicalLogs = props.savedLogs.filter(
    (record) => record.date < props.today,
  );
  const isBusy = props.isLoading || props.isSaving;
  const isDirty = props.input !== props.baseline;

  return (
    <div class="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        class="absolute inset-0 bg-black/20"
        aria-label="Discard historical changes and close"
        onClick$={props.onDiscard}
      />
      <aside
        class="relative flex h-full w-full max-w-xl animate-[history-slide-in_250ms_ease-out] flex-col bg-white shadow-2xl"
        aria-label="Historical HOS log"
      >
        <header class="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Historical record
            </p>
            <h2 class="mt-1 text-xl font-bold text-gray-800">
              {props.date
                ? new Date(`${props.date}T00:00:00`).toLocaleDateString()
                : "Select a day"}
            </h2>
            {isDirty && (
              <p class="mt-1 text-sm font-medium text-amber-700">
                Unsaved changes
              </p>
            )}
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Discard changes and close"
            onClick$={props.onDiscard}
          >
            &times;
          </button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto p-5">
          <label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-gray-700">
            Select historical day
            <input
              type="date"
              max={props.today}
              class="rounded-lg border border-gray-300 px-3 py-2"
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
                    class={`rounded-full border px-3 py-1 text-sm ${
                      props.date === record.date
                        ? "border-blue-700 bg-blue-50 text-blue-800"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick$={() => props.onSelectDay(record.date)}
                  >
                    {new Date(`${record.date}T00:00:00`).toLocaleDateString()}
                  </button>
                ))}
              </div>
            ) : (
              <p class="text-sm text-gray-500">
                No saved historical logs yet.
              </p>
            )}
          </div>

          {props.storageError && (
            <p role="alert" class="text-sm text-red-600">
              Local storage error: {props.storageError}
            </p>
          )}

          <div>
            <label
              for="historical-hos-log"
              class="mb-2 block text-sm font-semibold text-gray-700"
            >
              Daily HOS log
            </label>
            <textarea
              id="historical-hos-log"
              class="h-48 w-full rounded-lg border p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              disabled={isBusy}
              value={props.input}
              onInput$={props.onInput}
            />
            {props.error && (
              <p role="alert" class="mt-2 text-sm text-red-600">
                {props.error}
              </p>
            )}
          </div>

          <DurationBreakdown duration={props.duration} variant="section" />
        </div>

        <footer class="flex justify-end gap-3 border-t border-gray-200 p-5">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isBusy}
            onClick$={props.onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              isBusy ||
              !props.date ||
              Boolean(props.error) ||
              !isDirty
            }
            onClick$={props.onSave}
          >
            {props.isSaving ? "Saving..." : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
});
