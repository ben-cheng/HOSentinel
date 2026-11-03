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
  onSave$: QRL<(date: string, log: string) => Promise<boolean>>;
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

  const item = useComputed$<HistoryItem>(() => {
    const found = props.items.find((entry) => entry.date === selectedDate.value);
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
  });
  const save = $((log: string) => props.onSave$(selectedDate.value, log));

  return (
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700">
          Date
          <input
            type="date"
            class="rounded-lg border border-slate-300 px-3 py-1.5 font-normal"
            value={selectedDate.value}
            max={props.maxDate}
            onChange$={(_, el) => select(el.value)}
          />
        </label>
        <div class="flex flex-wrap items-center gap-2" aria-label="Past week">
          <span class="text-sm font-semibold text-slate-700">Past week</span>
          {weekDates.value.map((date) => (
            <button
              key={date}
              type="button"
              aria-pressed={date === selectedDate.value}
              class={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                date === selectedDate.value
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
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

      <section class="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-slate-900">
            {formatDate(item.value.date)}
            {!item.value.hasRecord && (
              <span class="ml-2 text-xs font-medium text-slate-500">
                No record
              </span>
            )}
          </h2>
          <button
            type="button"
            class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            onClick$={() => {
              isEditing.value = true;
            }}
          >
            Edit
          </button>
        </div>
        <LogEditForm log={item.value.log} mode="read" />
      </section>

      {isEditing.value && (
        <LogDialog
          title={formatDate(item.value.date)}
          log={item.value.log}
          mode="edit"
          onSave$={save}
          onClose$={closeEditor}
        />
      )}
    </div>
  );
});
