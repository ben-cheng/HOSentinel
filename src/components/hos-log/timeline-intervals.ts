import { STATUS_MAP, type DutyEntry, type StatusKey } from "./hours-of-service";

export type TimelineInterval = {
  start: number;
  end: number;
  status: StatusKey;
};

export const MINUTES_PER_DAY = 1440;

const KEY_BY_STATUS = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([key, status]) => [status, key]),
) as Record<string, StatusKey>;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function normalize(intervals: TimelineInterval[]): TimelineInterval[] {
  return intervals
    .filter((interval) => interval.end > interval.start)
    .reduce<TimelineInterval[]>((merged, interval) => {
      const last = merged[merged.length - 1];
      if (last?.status === interval.status) last.end = interval.end;
      else merged.push({ ...interval });
      return merged;
    }, []);
}

export function toTimelineIntervals(entries: DutyEntry[]): TimelineInterval[] {
  return normalize(
    entries.map((entry) => ({
      start: toMinutes(entry.startTime),
      end: toMinutes(entry.endTime),
      status: KEY_BY_STATUS[entry.status],
    })),
  );
}

/** Compact status-first log text; the final Off Duty interval is the default. */
export function toLogText(intervals: TimelineInterval[]): string {
  const merged = normalize(intervals);
  if (!merged.length) return "O";
  return merged
    .map((interval, index) => {
      const isLast = index === merged.length - 1;
      if (isLast && interval.status === "O") return "O";
      return `${interval.status}${formatMinute(interval.end).replace(":", "")}`;
    })
    .join("");
}
