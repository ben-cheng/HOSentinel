import { DutyEntry } from "~/models/duty-entry";
import {
  createEmptyStatusDuration,
  isStatusKey,
  STATUS_MAP,
  StatusDuration,
  StatusKey,
} from "~/models/duty-status";

function normalizeTime(raw: string): string {
  raw = raw.trim();

  // Case 1: H:mm or HH:mm
  if (raw.includes(":")) {
    let [h, m] = raw.split(":");

    if (!m) throw new Error(`Invalid time: ${raw}`);

    h = h.padStart(2, "0");
    m = m.padStart(2, "0");

    return `${h}:${m}`;
  }

  // Case 2: 3 or 4 digits → HHmm
  if (/^\d{3,4}$/.test(raw)) {
    const padded = raw.padStart(4, "0");
    const h = padded.slice(0, 2);
    const m = padded.slice(2);

    return `${h}:${m}`;
  }

  throw new Error(`Invalid time: ${raw}`);
}

// 🔹 Convert to minutes
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

type ParsedEntry = {
  time: string | null;
  status: StatusKey;
  token: string;
  kind: "all-day" | "interval-end" | "transition";
};

function parseEntries(input: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const compactLine = rawLine.replace(/\s/g, "");
    if (!compactLine) continue;

    const isTransitionLine = /^\d/.test(compactLine);
    const tokenPattern = isTransitionLine
      ? /(\d{1,2}:\d{2}|\d{3,4})([A-Za-z])/y
      : /([A-Za-z])(\d{1,2}:\d{2}|\d{3,4})?/y;
    let position = 0;

    while (position < compactLine.length) {
      tokenPattern.lastIndex = position;
      const match = tokenPattern.exec(compactLine);

      if (!match) {
        throw new Error(`Invalid format: "${compactLine.slice(position)}"`);
      }

      const token = match[0];
      const rawStatus = isTransitionLine ? match[2] : match[1];
      const rawTime = isTransitionLine ? match[1] : match[2];
      const status = rawStatus.toUpperCase();

      if (!isStatusKey(status)) {
        throw new Error(`Invalid status: "${token}"`);
      }

      const time = rawTime ? normalizeTime(rawTime) : null;

      if (time && toMinutes(time) > 1440) {
        throw new Error(`Time exceeds 24:00: "${token}"`);
      }

      entries.push({
        time,
        status,
        token,
        kind: time
          ? isTransitionLine
            ? "transition"
            : "interval-end"
          : "all-day",
      });
      position = tokenPattern.lastIndex;
    }
  }

  return entries;
}

export type ParseResult = {
  value: DutyEntry[];
  duration: StatusDuration;
  error: string | null;
};

export function getActiveDutyEntry(
  entries: DutyEntry[],
  minuteOfDay: number,
): DutyEntry | undefined {
  return entries.find((entry) => {
    const [startHour, startMinute] = entry.startTime.split(":").map(Number);
    const [endHour, endMinute] = entry.endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return minuteOfDay >= start && minuteOfDay < end;
  });
}

export function getDurationWithOffDutyRemainder(
  entries: DutyEntry[],
  minuteOfDay: number,
): StatusDuration {
  const duration = createEmptyStatusDuration();
  const currentMinute = Math.max(0, Math.min(minuteOfDay, 1440));

  for (const entry of entries) {
    const [startHour, startMinute] = entry.startTime.split(":").map(Number);
    const [endHour, endMinute] = entry.endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const elapsedEnd = Math.min(end, currentMinute);

    if (elapsedEnd <= start) continue;

    const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
      (key) => STATUS_MAP[key] === entry.status,
    );
    if (!status) {
      throw new Error(`Unable to find status key for "${entry.status}"`);
    }
    duration[status] += elapsedEnd - start;
  }

  duration.O += 1440 - currentMinute;
  return duration;
}

export function formatLogEntries(entries: DutyEntry[]): string[] {
  return entries.map((entry) => {
    const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
      (key) => STATUS_MAP[key] === entry.status,
    );

    if (!status) {
      throw new Error(
        `Unable to format unknown duty status: "${entry.status}"`,
      );
    }

    return entry.endTime === "24:00"
      ? status
      : `${status}${entry.endTime.replace(":", "")}`;
  });
}

export function getFinalStatus(entries: DutyEntry[]): StatusKey {
  const finalEntry = entries[entries.length - 1];
  if (!finalEntry) return "O";

  const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
    (key) => STATUS_MAP[key] === finalEntry.status,
  );

  if (!status) {
    throw new Error(`Unable to find final status for "${finalEntry.status}"`);
  }

  return status;
}

export function parseLogs(input: string): ParseResult {
  const result: DutyEntry[] = [];
  const duration = createEmptyStatusDuration();

  const parsedEntries = parseEntries(input);
  const allDayEntries = parsedEntries.filter(({ kind }) => kind === "all-day");

  if (allDayEntries.length > 1) {
    throw new Error("Only one status-only, all-day entry is allowed.");
  }

  const timedEntries = parsedEntries.filter(
    (entry): entry is ParsedEntry & { time: string } => entry.time !== null,
  );
  let previousMinutes = 0;

  for (const { time, token } of timedEntries) {
    const currentMinutes = toMinutes(time);

    if (currentMinutes <= previousMinutes) {
      throw new Error(`Time must be increasing: "${token}"`);
    }

    previousMinutes = currentMinutes;
  }

  const defaultStatus = allDayEntries[0]?.status ?? "O";
  const intervalEndEntries = new Map(
    timedEntries
      .filter(({ kind }) => kind === "interval-end")
      .map(({ time, status }) => [toMinutes(time), status]),
  );
  const transitions = timedEntries.filter(({ kind }) => kind === "transition");
  const boundaries = [0, ...timedEntries.map(({ time }) => toMinutes(time))];
  if (boundaries[boundaries.length - 1] !== 1440) boundaries.push(1440);

  for (let index = 1; index < boundaries.length; index++) {
    const startMinutes = boundaries[index - 1];
    const endMinutes = boundaries[index];
    const intervalStatus =
      intervalEndEntries.get(endMinutes) ??
      transitions
        .filter(({ time }) => toMinutes(time) <= startMinutes)
        .slice(-1)[0]?.status ??
      defaultStatus;
    const startTime = `${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}`;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    duration[intervalStatus] += endMinutes - startMinutes;
    const previousEntry = result[result.length - 1];
    if (previousEntry?.status === STATUS_MAP[intervalStatus]) {
      previousEntry.endTime = endTime;
    } else {
      result.push({
        startTime,
        endTime,
        status: STATUS_MAP[intervalStatus],
      });
    }
  }

  return {
    value: result,
    duration: duration,
    error: null,
  };
}
