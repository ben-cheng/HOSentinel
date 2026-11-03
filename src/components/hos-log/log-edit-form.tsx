import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { HosTimeline } from "./hos-timeline";
import {
  formModelToLog,
  logToFormModel,
  validateLog,
  type FormModel,
} from "./hos-log-form-model";
import { STATUS_LABEL, type StatusKey } from "./hours-of-service";

interface LogEditFormProps {
  /** Raw log text. */
  log: string;
  mode: "read" | "edit";
  cutoffMinute?: number;
  onSave$?: QRL<(log: string) => void>;
  onCancel$?: QRL<() => void>;
}

const STATUSES: StatusKey[] = ["O", "D", "N", "S"];
const EMPTY_MODEL: FormModel = { date: "", rows: [], trailing: "O" };

export const LogEditForm = component$((props: LogEditFormProps) => {
  const draft = useSignal(props.log);
  const view = useSignal<"gui" | "raw">("gui");
  const model = useSignal<FormModel>(EMPTY_MODEL);
  const error = useSignal<string | null>(null);

  useTask$(({ track }) => {
    const log = track(() => props.log);
    draft.value = log;
    try {
      model.value = logToFormModel(log);
      error.value = null;
    } catch (cause) {
      model.value = EMPTY_MODEL;
      error.value = cause instanceof Error ? cause.message : "Invalid log.";
    }
  });

  const setModel = $((next: FormModel) => {
    model.value = next;
    draft.value = formModelToLog(next);
    error.value = validateLog(draft.value);
  });

  const setRaw = $((text: string) => {
    draft.value = text;
    error.value = validateLog(text);
    if (!error.value) model.value = logToFormModel(text);
  });

  const readOnly = props.mode === "read";

  return (
    <div class="flex max-h-full min-h-0 flex-col gap-3">
      {!readOnly && (
        <div class="flex gap-2" role="tablist">
          {(["gui", "raw"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={view.value === tab}
              class={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view.value === tab ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`}
              onClick$={() => (view.value = tab)}
            >
              {tab === "gui" ? "Form" : "Raw text"}
            </button>
          ))}
        </div>
      )}

      <div class="min-h-0 flex-1 overflow-y-auto">
        {readOnly ? (
          <pre class="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-mono text-sm">
            {props.log}
          </pre>
        ) : view.value === "raw" ? (
          <textarea
            class="h-48 w-full rounded-xl border border-slate-300 p-3 font-mono text-sm"
            aria-label="Raw log"
            value={draft.value}
            onInput$={(_, el) => setRaw(el.value)}
          />
        ) : (
          <ol class="flex flex-col gap-2">
            {model.value.rows.map((row, index) => (
              <li key={index} class="flex flex-wrap items-center gap-2">
                <span class="w-12 text-sm text-slate-600">
                  {index === 0 ? "Start" : "then"}
                </span>
                <select
                  class="rounded-lg border border-slate-300 px-2 py-1.5"
                  aria-label={`Status ${index + 1}`}
                  value={row.status}
                  onChange$={(_, el) => {
                    const rows = model.value.rows.map((r, i) =>
                      i === index ? { ...r, status: el.value as StatusKey } : r,
                    );
                    setModel({ ...model.value, rows });
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} selected={s === row.status}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <span class="text-sm text-slate-600">until</span>
                <input
                  type="time"
                  class="rounded-lg border border-slate-300 px-2 py-1.5"
                  aria-label={`Until ${index + 1}`}
                  value={row.until}
                  onChange$={(_, el) => {
                    const rows = model.value.rows.map((r, i) =>
                      i === index ? { ...r, until: el.value } : r,
                    );
                    setModel({ ...model.value, rows });
                  }}
                />
                <button
                  type="button"
                  class="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                  aria-label={`Remove row ${index + 1}`}
                  onClick$={() =>
                    setModel({
                      ...model.value,
                      rows: model.value.rows.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
            <li class="flex flex-wrap items-center gap-2">
              <span class="w-12 text-sm text-slate-600">then</span>
              <select
                class="rounded-lg border border-slate-300 px-2 py-1.5"
                aria-label="Final status"
                value={model.value.trailing}
                onChange$={(_, el) =>
                  setModel({
                    ...model.value,
                    trailing: el.value as StatusKey,
                  })
                }
              >
                {STATUSES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    selected={s === model.value.trailing}
                  >
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <span class="text-sm text-slate-600">until end of day</span>
            </li>
            <li>
              <button
                type="button"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick$={() => {
                  const last = model.value.rows.at(-1)?.until ?? "00:00";
                  setModel({
                    ...model.value,
                    rows: [
                      ...model.value.rows,
                      { status: model.value.trailing, until: last },
                    ],
                  });
                }}
              >
                Add row
              </button>
            </li>
          </ol>
        )}
      </div>

      {error.value && (
        <p role="alert" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.value}
        </p>
      )}

      <div class="shrink-0">
        <HosTimeline log={draft.value} cutoffMinute={props.cutoffMinute} />
      </div>

      {!readOnly && (
        <div class="flex shrink-0 justify-end gap-2">
          {props.onCancel$ && (
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick$={() => props.onCancel$?.()}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            class="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!!error.value || draft.value === props.log}
            onClick$={() => props.onSave$?.(draft.value)}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
});
