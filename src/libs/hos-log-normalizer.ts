import type { DutyEntry } from "~/models/duty-entry";
import {
  createEmptyStatusDuration,
  isStatusKey,
  STATUS_MAP,
} from "~/models/duty-status";
import type { StatusDuration, StatusKey } from "~/models/duty-status";

type ParsedToken = {
  time: string | null;
  status: StatusKey;
};

export interface ParseOptions {
  date?: string;
  now?: Date;
  completedAt?: string | null;
  expectedDate?: string;
}

export type ParseResult = {
  value: DutyEntry[];
  duration: StatusDuration;
  error: string | null;
  date: string;
  canonicalEntries: string[];
  temporaryStatus: StatusKey | null;
  wasLegacy: boolean;
};

function toDateKey(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function toDateHeader(date: string): string {
  return date.replaceAll("-", "");
}

function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  let hour: number;
  let minute: number;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (
      parts.length !== 2 ||
      !/^\d{1,2}$/.test(parts[0]) ||
      !/^\d{2}$/.test(parts[1])
    ) {
      throw new Error(`Invalid time: ${raw}`);
    }
    hour = Number(parts[0]);
    minute = Number(parts[1]);
  } else if (/^\d{3,4}$/.test(trimmed)) {
    const padded = trimmed.padStart(4, "0");
    hour = Number(padded.slice(0, 2));
    minute = Number(padded.slice(2));
  } else {
    throw new Error(`Invalid time: ${raw}`);
  }

  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0)) {
    throw new Error(`Time exceeds 24:00 or has invalid minutes: "${raw}"`);
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function parseHeader(input: string): { date?: string; body: string } {
  const leadingWhitespace = input.match(/^\s*/)?.[0].length ?? 0;
  const match = input
    .slice(leadingWhitespace)
    .match(/^(\d{8}|\d{4}-\d{2}-\d{2})(?=\s|[A-Za-z]|$)/);
  if (!match) return { body: input };

  const date = toDateKey(match[1]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid log date: "${match[1]}"`);
  }
  const timestamp = new Date(`${date}T00:00:00`);
  if (
    Number.isNaN(timestamp.getTime()) ||
    getLocalDateKey(timestamp) !== date
  ) {
    throw new Error(`Invalid log date: "${match[1]}"`);
  }
  const bodyStart = leadingWhitespace + match[1].length;
  return { date, body: input.slice(bodyStart) };
}

function parseStatusToken(token: string, timestampFirst: boolean): ParsedToken {
  const match = timestampFirst
    ? token.match(/^(\d{1,2}:\d{2}|\d{3,4})([A-Za-z])$/)
    : token.match(/^([A-Za-z])(\d{1,2}:\d{2}|\d{3,4})?$/);
  if (!match) throw new Error(`Invalid format: "${token}"`);

  const rawStatus = timestampFirst ? match[2] : match[1];
  const rawTime = timestampFirst ? match[1] : match[2];
  const status = rawStatus.toUpperCase();
  if (!isStatusKey(status)) throw new Error(`Invalid status: "${token}"`);

  return { status, time: rawTime ? normalizeTime(rawTime) : null };
}

function parseTokens(body: string): {
  tokens: ParsedToken[];
  wasLegacy: boolean;
} {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/\s/g, ""))
    .filter(Boolean);
  if (!lines.length) return { tokens: [], wasLegacy: false };

  const transitionLines = lines.map((line) => /^\d/.test(line));
  const wasLegacy = transitionLines.some(Boolean);
  if (wasLegacy && transitionLines.some((isTransition) => !isTransition)) {
    const allowedLeadingDefault =
      !transitionLines[0] &&
      lines[0].length === 1 &&
      lines[0].toUpperCase() === "O" &&
      transitionLines.slice(1).every(Boolean);
    if (!allowedLeadingDefault) {
      throw new Error(
        "Do not mix timestamp-first and status-first log entries.",
      );
    }
  }

  if (!wasLegacy) {
    const tokens: ParsedToken[] = [];
    for (const line of lines) {
      let position = 0;
      const pattern = /([A-Za-z])(\d{1,2}:\d{2}|\d{3,4})?/y;
      while (position < line.length) {
        pattern.lastIndex = position;
        const match = pattern.exec(line);
        if (!match)
          throw new Error(`Invalid format: "${line.slice(position)}"`);
        tokens.push(parseStatusToken(match[0], false));
        position = pattern.lastIndex;
      }
    }
    return { tokens, wasLegacy: false };
  }

  const startTokens: ParsedToken[] = [];
  const hasInitialOffDuty = !transitionLines[0];
  for (const line of lines.slice(hasInitialOffDuty ? 1 : 0)) {
    let position = 0;
    const pattern = /(\d{1,2}:\d{2}|\d{3,4})([A-Za-z])/y;
    while (position < line.length) {
      pattern.lastIndex = position;
      const match = pattern.exec(line);
      if (!match)
        throw new Error(`Invalid legacy format: "${line.slice(position)}"`);
      startTokens.push(parseStatusToken(match[0], true));
      position = pattern.lastIndex;
    }
  }

  const starts = startTokens.filter(
    (token): token is ParsedToken & { time: string } => token.time !== null,
  );
  let previous = -1;
  for (const token of starts) {
    const time = toMinutes(token.time);
    if (time <= previous)
      throw new Error("Time entries must be strictly increasing.");
    previous = time;
  }

  const converted: ParsedToken[] = [];
  if (starts.length && toMinutes(starts[0].time) > 0) {
    converted.push({ status: "O", time: starts[0].time });
  }
  for (let index = 0; index < starts.length; index++) {
    const next = starts[index + 1];
    converted.push({
      status: starts[index].status,
      time: next?.time ?? null,
    });
  }
  return { tokens: converted, wasLegacy: true };
}

function normalizeCanonicalTokens(tokens: ParsedToken[]): ParsedToken[] {
  const timed = tokens.filter((token) => token.time !== null);
  const temporary = tokens.filter((token) => token.time === null);
  if (
    temporary.length > 1 ||
    (temporary.length && tokens.at(-1)?.time !== null)
  ) {
    throw new Error(
      "Only one temporary status is allowed, and it must be last.",
    );
  }

  let previous = 0;
  for (const token of timed) {
    const time = toMinutes(token.time!);
    if (time <= previous)
      throw new Error("Time entries must be strictly increasing.");
    previous = time;
  }

  const collapsed: ParsedToken[] = [];
  for (const token of timed) {
    const last = collapsed[collapsed.length - 1];
    if (last?.status === token.status) {
      last.time = token.time;
    } else {
      collapsed.push({ ...token });
    }
  }
  const temp = temporary[0];
  if (temp) {
    const last = collapsed[collapsed.length - 1];
    if (last?.status === temp.status) collapsed.pop();
    collapsed.push({ ...temp });
  }
  return collapsed;
}

export function formatLogEntries(entries: DutyEntry[]): string[] {
  return entries.map((entry) => {
    const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
      (key) => STATUS_MAP[key] === entry.status,
    );
    if (!status)
      throw new Error(
        `Unable to format unknown duty status: "${entry.status}"`,
      );
    return entry.endTime === "24:00"
      ? status
      : `${status}${entry.endTime.replace(":", "")}`;
  });
}

export function formatDailyLog(date: string, entries: string[]): string {
  return [toDateHeader(toDateKey(date)), ...entries].join("\n");
}

export function endsAtEndOfDay(entries: string[]): boolean {
  return /^[A-Z]2400$/.test(entries.at(-1) ?? "");
}

export function finalizeCompletedLogEntries(
  entries: string[],
  completedAt: string,
): string[] {
  const completionTime = new Date(completedAt);
  if (Number.isNaN(completionTime.getTime())) {
    throw new Error(`Invalid day completion timestamp: "${completedAt}"`);
  }

  const finalized = [...entries];
  const completionMinute =
    completionTime.getHours() * 60 + completionTime.getMinutes();
  const lastEntry = finalized.at(-1);
  const temporaryStatus = lastEntry?.match(/^([A-Z])$/)?.[1];
  if (temporaryStatus) {
    const previousTimedEntry = finalized.at(-2)?.match(/^([A-Z])(\d{4})$/);
    const previousMinute = previousTimedEntry
      ? Number(previousTimedEntry[2].slice(0, 2)) * 60 +
        Number(previousTimedEntry[2].slice(2))
      : 0;

    if (completionMinute > previousMinute) {
      finalized[finalized.length - 1] =
        `${temporaryStatus}${formatTime(completionMinute).replace(":", "")}`;
    } else {
      finalized.pop();
    }
  }

  const finalTimedEntry = finalized.at(-1)?.match(/^([A-Z])(\d{4})$/);
  if (finalTimedEntry?.[2] === "2400") return finalized;
  if (finalTimedEntry?.[1] === "O") {
    finalized[finalized.length - 1] = "O2400";
  } else {
    finalized.push("O2400");
  }
  return finalized;
}

export function reopenCompletedLogEntries(
  entries: string[],
  completedAt: string,
): string[] {
  const completionTime = new Date(completedAt);
  if (Number.isNaN(completionTime.getTime())) {
    throw new Error(`Invalid day completion timestamp: "${completedAt}"`);
  }

  const reopened = [...entries];
  const endOfDayEntry = reopened.at(-1)?.match(/^([A-Z])2400$/);
  if (endOfDayEntry) {
    reopened.pop();
    if (endOfDayEntry[1] !== "O") reopened.push(endOfDayEntry[1]);
  }

  const completionTimeToken = formatTime(
    completionTime.getHours() * 60 + completionTime.getMinutes(),
  ).replace(":", "");
  const finalTimedEntry = reopened.at(-1)?.match(/^([A-Z])(\d{4})$/);
  if (finalTimedEntry?.[2] === completionTimeToken) {
    reopened[reopened.length - 1] = finalTimedEntry[1];
  }

  return reopened.length ? reopened : ["O"];
}

export function getActiveDutyEntry(
  entries: DutyEntry[],
  minuteOfDay: number,
): DutyEntry | undefined {
  return entries.find((entry) => {
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);
    return minuteOfDay >= start && minuteOfDay < end;
  });
}

export function getFinalStatus(entries: DutyEntry[]): StatusKey {
  const finalEntry = entries[entries.length - 1];
  if (!finalEntry) return "O";
  const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
    (key) => STATUS_MAP[key] === finalEntry.status,
  );
  if (!status)
    throw new Error(`Unable to find final status for "${finalEntry.status}"`);
  return status;
}

export function getElapsedDuration(
  entries: DutyEntry[],
  minuteOfDay: number,
): StatusDuration {
  const duration = createEmptyStatusDuration();
  const cutoff = Math.max(0, Math.min(minuteOfDay, 1440));
  for (const entry of entries) {
    const start = toMinutes(entry.startTime);
    const end = Math.min(toMinutes(entry.endTime), cutoff);
    if (end <= start) continue;
    const status = (Object.keys(STATUS_MAP) as StatusKey[]).find(
      (key) => STATUS_MAP[key] === entry.status,
    );
    if (!status)
      throw new Error(`Unable to find status key for "${entry.status}"`);
    duration[status] += end - start;
  }
  return duration;
}

export function parseLogs(
  input: string,
  options: ParseOptions = {},
): ParseResult {
  const now = options.now ?? new Date();
  const header = parseHeader(input);
  const date = header.date ?? toDateKey(options.date ?? getLocalDateKey(now));
  if (options.expectedDate && date !== toDateKey(options.expectedDate)) {
    throw new Error(
      `Log date ${date} does not match selected day ${options.expectedDate}.`,
    );
  }

  const parsed = parseTokens(header.body);
  let tokens = parsed.tokens;
  tokens = normalizeCanonicalTokens(tokens);

  const temporaryStatus =
    tokens.at(-1)?.time === null ? tokens.at(-1)!.status : null;
  const timedTokens = temporaryStatus ? tokens.slice(0, -1) : tokens;

  const ranges: Array<{ start: number; end: number; status: StatusKey }> = [];
  let previous = 0;
  for (const token of timedTokens) {
    const end = toMinutes(token.time!);
    if (end <= previous)
      throw new Error("Time entries must be strictly increasing.");
    ranges.push({ start: previous, end, status: token.status });
    previous = end;
  }

  const isToday = date === getLocalDateKey(now);
  const completionTime = options.completedAt
    ? new Date(options.completedAt)
    : null;
  if (completionTime && Number.isNaN(completionTime.getTime())) {
    throw new Error(
      `Invalid day completion timestamp: "${options.completedAt}"`,
    );
  }
  const completedMinute =
    completionTime && getLocalDateKey(completionTime) === date
      ? completionTime.getHours() * 60 + completionTime.getMinutes()
      : null;
  const temporaryEnd =
    completedMinute !== null
      ? completedMinute
      : isToday
        ? Math.min(now.getHours() * 60 + now.getMinutes() + 1, 1440)
        : 1440;

  if (temporaryStatus && previous < temporaryEnd) {
    ranges.push({
      start: previous,
      end: temporaryEnd,
      status: temporaryStatus,
    });
    previous = temporaryEnd;
  }
  if (previous < 1440) {
    ranges.push({ start: previous, end: 1440, status: "O" });
  }
  if (!ranges.length) ranges.push({ start: 0, end: 1440, status: "O" });

  const mergedRanges = ranges.reduce<typeof ranges>((merged, range) => {
    const last = merged[merged.length - 1];
    if (last?.status === range.status && last.end === range.start)
      last.end = range.end;
    else merged.push({ ...range });
    return merged;
  }, []);

  const value = mergedRanges.map((range) => ({
    startTime: formatTime(range.start),
    endTime: formatTime(range.end),
    status: STATUS_MAP[range.status],
  }));
  const cutoff =
    isToday && completedMinute === null
      ? now.getHours() * 60 + now.getMinutes()
      : 1440;
  const duration = getElapsedDuration(value, cutoff);
  const canonicalEntries = tokens.map((token) =>
    token.time ? `${token.status}${token.time.replace(":", "")}` : token.status,
  );

  return {
    value,
    duration,
    error: null,
    date,
    canonicalEntries,
    temporaryStatus,
    wasLegacy: parsed.wasLegacy,
  };
}
