import { STATUS_MAP, type DutyEntry, type StatusKey } from "./hours-of-service";

export type TimelineInterval = {
  start: number;
  end: number;
  status: StatusKey;
};

export const SNAP_MINUTES = 15;
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

export function snapMinute(minute: number): number {
  return Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES;
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

/**
 * Sets a status at a minute. Inside a bounded interval the new status covers
 * the part before the click; inside the last (open-ended) interval it covers
 * the part after the click.
 */
export function addStatusAt(
  intervals: TimelineInterval[],
  rawMinute: number,
  status: StatusKey,
): TimelineInterval[] {
  const minute = snapMinute(rawMinute);
  const index = intervals.findIndex(
    (interval) => interval.start < minute && minute < interval.end,
  );
  if (index === -1 || intervals[index].status === status) return intervals;

  const target = intervals[index];
  const isLast = index === intervals.length - 1;
  const split: TimelineInterval[] = isLast
    ? [
        { ...target, end: minute },
        { start: minute, end: target.end, status },
      ]
    : [
        { start: target.start, end: minute, status },
        { ...target, start: minute },
      ];
  return normalize([
    ...intervals.slice(0, index),
    ...split,
    ...intervals.slice(index + 1),
  ]);
}

/** Removes the node at the end of interval `index`; the next interval extends back. */
export function removeNode(
  intervals: TimelineInterval[],
  index: number,
): TimelineInterval[] {
  if (index < 0 || index >= intervals.length - 1) return intervals;
  return normalize([
    ...intervals.slice(0, index),
    { ...intervals[index + 1], start: intervals[index].start },
    ...intervals.slice(index + 2),
  ]);
}

export function clampNodeMinute(
  intervals: TimelineInterval[],
  index: number,
  rawMinute: number,
): number {
  const low = intervals[index].start + SNAP_MINUTES;
  const high = intervals[index + 1].end - SNAP_MINUTES;
  return Math.min(high, Math.max(low, snapMinute(rawMinute)));
}

export function moveNode(
  intervals: TimelineInterval[],
  index: number,
  rawMinute: number,
): TimelineInterval[] {
  if (index < 0 || index >= intervals.length - 1) return intervals;
  const minute = clampNodeMinute(intervals, index, rawMinute);
  return intervals.map((interval, position) => {
    if (position === index) return { ...interval, end: minute };
    if (position === index + 1) return { ...interval, start: minute };
    return interval;
  });
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
