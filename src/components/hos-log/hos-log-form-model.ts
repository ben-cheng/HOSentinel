import { formatDailyLog, parseLogs } from "./hos-log-normalizer";
import type { StatusKey } from "./hours-of-service";

export interface FormRow {
  status: StatusKey;
  until: string;
}

export interface FormModel {
  date: string;
  rows: FormRow[];
  trailing: StatusKey;
  /** "now": the final status is still running (today); "end": it lasts to 24:00. */
  trailingUntil: "now" | "end";
}

const TIMED_ENTRY = /^([OSDN])(\d{2})(\d{2})$/;

const toMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Converts a raw log string into "[status] until [time]" rows. */
export function logToFormModel(log: string): FormModel {
  const parsed = parseLogs(log);
  const rows: FormRow[] = [];
  let trailing: StatusKey = "O";
  let trailingUntil: FormModel["trailingUntil"] = "now";
  for (const entry of parsed.canonicalEntries) {
    const match = entry.match(TIMED_ENTRY);
    if (!match) {
      trailing = entry as StatusKey;
      continue;
    }
    const until = `${match[2]}:${match[3]}`;
    if (until === "24:00") {
      trailing = match[1] as StatusKey;
      trailingUntil = "end";
    } else {
      rows.push({ status: match[1] as StatusKey, until });
    }
  }
  return { date: parsed.date, rows, trailing, trailingUntil };
}

/**
 * Converts form rows back to the raw log string. Past days always end at
 * 24:00, which a bare final status already means.
 */
export function formModelToLog(
  model: FormModel,
  options: { isToday?: boolean } = {},
): string {
  const entries = model.rows.map(
    (row) => `${row.status}${row.until.replace(":", "")}`,
  );
  entries.push(
    options.isToday && model.trailingUntil === "end"
      ? `${model.trailing}2400`
      : model.trailing,
  );
  return formatDailyLog(model.date, entries);
}

/** Inserts a row before `index` (use rows.length to add at the end), splitting the gap in half. */
export function insertRowBefore(model: FormModel, index: number): FormModel {
  const previous = index > 0 ? toMinutes(model.rows[index - 1].until) : 0;
  const next =
    index < model.rows.length ? toMinutes(model.rows[index].until) : 1440;
  const middle = Math.floor((previous + next) / 2);
  if (middle <= previous) return model;
  const status = model.rows[index]?.status ?? model.trailing;
  const rows = [...model.rows];
  rows.splice(index, 0, { status, until: toTime(middle) });
  return { ...model, rows };
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
