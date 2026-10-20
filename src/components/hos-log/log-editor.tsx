
import type { QRL } from "@qwik.dev/core";
import { component$, useSignal } from "@qwik.dev/core";

export interface LogEditorProps {
    onSubmit: QRL<(logText: string) => void>;
    value: string;
    disabled: boolean;
    readOnly: boolean;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    storageError: string | null;
    onInput: QRL<(logText: string) => void>;
    onSave: QRL<(logText: string) => Promise<boolean>>;
    onDiscard: QRL<() => void>;
    onClose: QRL<() => void>;
}

export const LogEditor = component$((props: LogEditorProps) => {
    const editedLog = useSignal("");
    const saveError = useSignal<string | null>(null);
    
    return (
          <form
            class="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-log-dialog-title"
            onSubmit$={(event) => {
              event.preventDefault();
              props.onSubmit(editedLog.value);
            }}
          >
            <h2
              id="today-log-dialog-title"
              class="text-xl font-bold tracking-tight text-slate-900"
            >
              {props.readOnly ? "View log" : "Edit log"}
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
              readOnly={props.readOnly}
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
              {!props.readOnly && (
                <>
                  <button
                    type="submit"
                    class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={props.isSaving}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      props.disabled || editedLog.value === props.value
                    }
                  >
                    {props.isSaving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </footer>
          </form>
    );
});