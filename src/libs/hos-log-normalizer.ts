import { DutyEntry } from "~/models/duty-entry";
import { createEmptyStatusDuration, isStatusKey, STATUS_MAP, StatusDuration, StatusKey } from "~/models/duty-status";

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

function parseLine(line: string): { time: string | null; status: StatusKey } {
  const cleaned = line.replace(/\s+/g, "");
  const statusOnlyMatch = cleaned.match(/^([A-Za-z]+)$/);

  if (statusOnlyMatch) {
    const status = statusOnlyMatch[1].toUpperCase();

    if (!isStatusKey(status)) {
      throw new Error(`Invalid status: "${line}"`);
    }

    return { time: null, status };
  }

  const match = cleaned.match(/^([A-Za-z]+)(\d{1,2}:?\d{2})$/);

  if (!match) {
    throw new Error(`Invalid format: "${line}"`);
  }

  const [, rawStatus, rawTime] = match;
  const status = rawStatus.toUpperCase();

  if (!isStatusKey(status)) {
    throw new Error(`Invalid status: "${line}"`);
  }

  const time = normalizeTime(rawTime);

  if (toMinutes(time) > 1440) {
    throw new Error(`Time exceeds 24:00: "${line}"`);
  }

  return { time, status };
}

export type ParseResult = {
    value: DutyEntry[];
    duration: StatusDuration;
    error: string | null;
}

export function parseLogs(input: string): ParseResult {

  const lines = input.split("\n");

  const result: DutyEntry[] = [];
  const duration = createEmptyStatusDuration();

  const parsedLines = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ ...parseLine(line), line }));
  const allDayEntries = parsedLines.filter(({ time }) => time === null);

  if (allDayEntries.length > 1) {
    throw new Error("Only one status-only, all-day entry is allowed.");
  }

  let prevTime = "00:00";
  let prevMinutes = 0;

  for (const { time, status, line } of parsedLines) {
    if (time === null) continue;

    const currentMinutes = toMinutes(time);

    if (currentMinutes <= prevMinutes) {
      throw new Error(`Time must be increasing: "${line}"`);
    }

    duration[status] += currentMinutes - prevMinutes;

    result.push({
      startTime: prevTime,
      endTime: time,
      status: STATUS_MAP[status],
    });

    prevTime = time;
    prevMinutes = currentMinutes;
  }

  // Fill to 24:00
  if (prevMinutes < 1440) {
    const finalStatus = allDayEntries[0]?.status ?? "O";
    duration[finalStatus] += 1440 - prevMinutes;

    result.push({
      startTime: prevTime,
      endTime: "24:00",
      status: STATUS_MAP[finalStatus],
    });
  }

  return {
    value: result,
    duration: duration,
    error: null,
  }
}