import {
  formatLogEntries,
  getActiveDutyEntry,
  parseLogs,
} from "~/libs/hos-log-normalizer";
import { STATUS_MAP } from "~/models/duty-status";
import type { DutyStatus, StatusKey } from "~/models/duty-status";

function getMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function mergeAdjacentEntries(
  entries: Array<{ startTime: string; endTime: string; status: DutyStatus }>,
) {
  return entries.reduce<typeof entries>((merged, entry) => {
    const previous = merged[merged.length - 1];
    if (previous?.status === entry.status) {
      previous.endTime = entry.endTime;
    } else {
      merged.push({ ...entry });
    }
    return merged;
  }, []);
}

export function updateLogForStatus(
  input: string,
  status: StatusKey,
  now: Date,
): string {
  const entries = parseLogs(input).value;
  const minute = getMinuteOfDay(now);
  const activeEntry = getActiveDutyEntry(entries, minute);
  const canonicalLog = formatLogEntries(entries).join("\n");

  if (!activeEntry || minute >= 1440) return canonicalLog;

  const requestedStatus = STATUS_MAP[status];
  const startMinutes =
    Number(activeEntry.startTime.slice(0, 2)) * 60 +
    Number(activeEntry.startTime.slice(3, 5));
  if (activeEntry.status === requestedStatus) return canonicalLog;

  const updatedEntries =
    minute === startMinutes
      ? entries.map((entry) =>
          entry === activeEntry ? { ...entry, status: requestedStatus } : entry,
        )
      : [
          ...entries.slice(0, entries.indexOf(activeEntry)),
          {
            ...activeEntry,
            endTime: formatTime(minute),
          },
          {
            ...activeEntry,
            startTime: formatTime(minute),
            status: requestedStatus,
          },
          ...entries.slice(entries.indexOf(activeEntry) + 1),
        ];

  return formatLogEntries(mergeAdjacentEntries(updatedEntries)).join("\n");
}
