import { component$, useComputed$, useSignal, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { LogDialog } from "./log-dialog";
import { LogEditForm } from "./log-edit-form";
import { formatDailyLog } from "./hos-log-normalizer";
import { getPreviousLocalDateKey } from "./date-utils";
import type { HistoryItem } from "./history-items";

interface HistoryListProps {
  items: HistoryItem[];
  /** Latest selectable date (yesterday); also the default selection. */
  maxDate: string;
  onSave$: QRL<
    (
      date: string,
      log: string,
      updatedAt: string | null,
      completedAt: string | null,
    ) => Promise<boolean>
  >;
  disabled?: boolean;
}

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function formatDate(date: string): string {
  return toDate(date).toLocaleDateString();
}

export const HistoryList = component$((props: HistoryListProps) => {
  const selectedDate = useSignal(props.maxDate);
  const isEditing = useSignal(false);
  const editingItem = useSignal<HistoryItem | null>(null);

  const item = useComputed$<HistoryItem>(() => {
    const found = props.items.find(
      (entry) => entry.date === selectedDate.value,
    );
    return (
      found ?? {
        date: selectedDate.value,
        log: formatDailyLog(selectedDate.value, ["O"]),
        hasRecord: false,
      }
    );
  });
  const weekDates = useComputed$(() => {
    const dates = [props.maxDate];
    while (dates.length < 7) {
      dates.push(getPreviousLocalDateKey(dates[dates.length - 1]));
    }
    return dates;
  });

  const select = $((date: string) => {
    if (date && date <= props.maxDate) selectedDate.value = date;
  });
  const closeEditor = $(() => {
    isEditing.value = false;
    editingItem.value = null;
  });
  const save = $((log: string) => {
    const editing = editingItem.value;
    if (!editing || props.disabled) return Promise.resolve(false);
    return props.onSave$(
      editing.date,
      log,
      editing.updatedAt ?? null,
      editing.completedAt ?? null,
    );
  });

  return (
    <div class="space-y-5">
      <section
        class="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
        aria-labelledby="history-date-heading"
      >
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3
              id="history-date-heading"
              class="text-base font-semibold text-slate-900"
            >
              Choose a day
            </h3>
            <p class="mt-1 text-sm text-slate-600">
              Pick a date or use a recent-day shortcut.
            </p>
          </div>
          <label class="flex w-full flex-col gap-1.5 text-sm font-semibold text-slate-700 sm:w-auto">
            Date
            <input
              type="date"
              class="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
              value={selectedDate.value}
              max={props.maxDate}
              onChange$={(_, el) => select(el.value)}
            />
          </label>
        </div>
        <div role="group" aria-label="Past week">
          <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Past week
          </p>
          <div class="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-7">
            {weekDates.value.map((date) => (
              <button
                key={date}
                type="button"
                aria-pressed={date === selectedDate.value}
                class={`min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  date === selectedDate.value
                    ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                }`}
                onClick$={() => select(date)}
              >
                {toDate(date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                })}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Selected day
            </p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <h3 class="text-lg font-semibold text-slate-900">
                {formatDate(item.value.date)}
              </h3>
              {!item.value.hasRecord && (
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  No record
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={props.disabled}
            class="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            onClick$={() => {
              editingItem.value = item.value;
              isEditing.value = true;
            }}
          >
            Edit log
          </button>
        </div>
        <h4 class="text-sm font-semibold text-slate-700">
          Duty entries and timeline
        </h4>
        <LogEditForm log={item.value.log} mode="read" />
      </section>

      {isEditing.value && editingItem.value && (
        <LogDialog
          title={formatDate(editingItem.value.date)}
          log={editingItem.value.log}
          mode="edit"
          onSave$={save}
          onClose$={closeEditor}
        />
      )}
    </div>
  );
});
