import {
  formatDailyLog,
  formatLogEntries,
  parseLogs,
} from "./hos-log-normalizer";
import type { StatusKey } from "./hours-of-service";

export interface FormRow {
  status: StatusKey;
  until: string;
}

export interface FormModel {
  date: string;
  rows: FormRow[];
  trailing: StatusKey;
}

const TIMED_ENTRY = /^([OSDN])(\d{2})(\d{2})$/;

/** Converts a raw log string into "[status] until [time]" rows. */
export function logToFormModel(log: string): FormModel {
  const parsed = parseLogs(log);
  const entries = formatLogEntries(parsed.value);
  const rows: FormRow[] = [];
  let trailing: StatusKey = "O";
  for (const entry of entries) {
    const match = entry.match(TIMED_ENTRY);
    if (match) rows.push({ status: match[1] as StatusKey, until: `${match[2]}:${match[3]}` });
    else trailing = entry as StatusKey;
  }
  return { date: parsed.date, rows, trailing };
}

/** Converts form rows back to the raw log string. */
export function formModelToLog(model: FormModel): string {
  const entries = model.rows.map(
    (row) => `${row.status}${row.until.replace(":", "")}`,
  );
  entries.push(model.trailing);
  return formatDailyLog(model.date, entries);
}

/** Returns an error message when the log string is not valid, otherwise null. */
export function validateLog(log: string): string | null {
  try {
    parseLogs(log);
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : "Invalid log.";
  }
}
