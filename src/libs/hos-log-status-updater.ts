import {
  formatDailyLog,
  getActiveDutyEntry,
  parseLogs,
} from "~/libs/hos-log-normalizer";
import type { DutyEntry } from "~/models/duty-entry";
import type { StatusKey } from "~/models/duty-status";

function getMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}`;
}

function statusKeyForEntry(entry: DutyEntry): StatusKey {
  switch (entry.status) {
    case "OFF_DUTY":
      return "O";
    case "SLEEPER":
      return "S";
    case "DRIVING":
      return "D";
    case "ON_DUTY_NOT_DRIVING":
      return "N";
  }
}

export function updateLogForStatus(
  input: string,
  status: StatusKey,
  now: Date,
): string {
  const parsed = parseLogs(input, { now });
  const minute = getMinuteOfDay(now);
  const activeEntry = getActiveDutyEntry(parsed.value, minute);
  if (activeEntry && statusKeyForEntry(activeEntry) === status) return input;

  const entries: string[] = [];
  for (const entry of parsed.value) {
    const start =
      Number(entry.startTime.slice(0, 2)) * 60 +
      Number(entry.startTime.slice(3));
    const end = Math.min(
      Number(entry.endTime.slice(0, 2)) * 60 + Number(entry.endTime.slice(3)),
      minute,
    );
    if (end <= start) continue;
    entries.push(`${statusKeyForEntry(entry)}${formatTime(end)}`);
  }
  entries.push(status);
  return formatDailyLog(parsed.date, entries);
}
