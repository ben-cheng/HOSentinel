import { $, component$, useContext, useSignal } from "@qwik.dev/core";
import {
  HosStorageContext,
  type HosLogRecord,
} from "./context/hos-storage-provider";
import {
  formatBackup,
  parseBackup,
  selectBackupRecords,
} from "./hos-log-backup";

export const HosLogBackupPanel = component$(() => {
  const { storageReady, refreshSavedLogs, importLogs } =
    useContext(HosStorageContext);
  const pending = useSignal<HosLogRecord[]>([]);
  const conflicts = useSignal<string[]>([]);
  const approved = useSignal<string[]>([]);
  const busy = useSignal(false);
  const error = useSignal<string | null>(null);
  const message = useSignal<string | null>(null);
  const exportFrom = useSignal("");
  const exportThrough = useSignal("");

  const attemptImport = $(
    async (records: HosLogRecord[], approvedDates: string[]) => {
      const conflictingDates = await importLogs(records, approvedDates);
      if (conflictingDates.length) {
        pending.value = records;
        approved.value = approvedDates;
        conflicts.value = conflictingDates;
      } else {
        pending.value = [];
        approved.value = [];
        conflicts.value = [];
        message.value = `Imported ${records.length} ${records.length === 1 ? "day" : "days"}.`;
      }
    },
  );

  const exportBackup = $(async () => {
    busy.value = true;
    error.value = null;
    message.value = null;
    try {
      const from = exportFrom.value;
      const through = exportThrough.value;
      const records = selectBackupRecords(await refreshSavedLogs(), from, through);
      if (!records.length)
        throw new Error("There are no saved logs in the selected date range.");
      const url = URL.createObjectURL(
        new Blob([formatBackup(records)], { type: "text/plain;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "hosentinel-backup.txt";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      message.value = `Exported ${records.length} ${records.length === 1 ? "day" : "days"}.`;
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not export logs.";
    } finally {
      busy.value = false;
    }
  });

  const readBackup = $(async (file: File) => {
    busy.value = true;
    error.value = null;
    message.value = null;
    pending.value = [];
    conflicts.value = [];
    approved.value = [];
    try {
      const records = parseBackup(await file.text(), new Date().toISOString());
      await attemptImport(records, []);
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not import logs.";
    } finally {
      busy.value = false;
    }
  });

  const confirmImport = $(async () => {
    busy.value = true;
    error.value = null;
    try {
      await attemptImport(pending.value, [
        ...approved.value,
        ...conflicts.value,
      ]);
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "Could not import logs.";
    } finally {
      busy.value = false;
    }
  });

  return (
    <section
      class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
      aria-labelledby="backup-heading"
    >
      <div>
        <h3 id="backup-heading" class="text-base font-semibold text-slate-900">
          Import and export
        </h3>
        <p class="mt-1 text-sm text-slate-600">
          Back up your logs as a text file or import a previous backup.
        </p>
      </div>
      <div>
        <p class="text-sm font-semibold text-slate-700">Export date range</p>
        <p class="mt-1 text-sm text-slate-600">
          Dates are inclusive. Leave both blank to export all saved logs.
        </p>
        <div class="mt-3 flex flex-wrap gap-3">
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            From
            <input
              type="date"
              value={exportFrom.value}
              disabled={busy.value}
              onInput$={(_, input) => (exportFrom.value = input.value)}
              class="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Through
            <input
              type="date"
              value={exportThrough.value}
              disabled={busy.value}
              onInput$={(_, input) => (exportThrough.value = input.value)}
              class="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            />
          </label>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!storageReady.value || busy.value}
          onClick$={exportBackup}
        >
          Export backup
        </button>
        <label class="relative inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600 has-disabled:cursor-not-allowed has-disabled:opacity-50">
          Import backup
          <input
            type="file"
            accept=".txt,text/plain"
            aria-label="Import backup"
            class="absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={!storageReady.value || busy.value}
            onChange$={(_, input) => {
              const file = input.files?.[0];
              input.value = "";
              if (file) return readBackup(file);
            }}
          />
        </label>
      </div>
      {conflicts.value.length > 0 && (
        <div
          class="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <p class="font-semibold">Existing logs will be replaced</p>
          <p>
            These dates already have saved logs: {conflicts.value.join(", ")}.
          </p>
          <p>
            Export a backup of your existing logs before continuing. Leave both
            export dates blank to include every saved day. No records have been
            imported yet.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy.value}
              onClick$={confirmImport}
              class="min-h-11 rounded-xl bg-amber-800 px-4 py-2 font-semibold text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:opacity-50"
            >
              Replace and import
            </button>
            <button
              type="button"
              disabled={busy.value}
              onClick$={() => {
                pending.value = [];
                conflicts.value = [];
                approved.value = [];
              }}
              class="min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error.value && (
        <p role="alert" class="text-sm text-red-700">
          {error.value}
        </p>
      )}
      {message.value && (
        <p role="status" class="text-sm text-green-700">
          {message.value}
        </p>
      )}
    </section>
  );
});
