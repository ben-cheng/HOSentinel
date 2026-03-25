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

// 🔹 Extract time + status from messy input
function parseLine(line: string): { time: string; status: StatusKey } {
  const cleaned = line.replace(/\s+/g, "");

  // Match: time + status (e.g. 0934O, 9:34D, etc.)
  const match = cleaned.match(/^(\d{1,2}:?\d{2})([A-Za-z]+)$/);

  if (!match) {
    throw new Error(`Invalid format: "${line}"`);
  }

  const [, rawTime, rawStatus] = match;

  const time = normalizeTime(rawTime);
  const minutes = toMinutes(time);

  if (minutes > 1440) {
    throw new Error(`Time exceeds 24:00: "${line}"`);
  }

  const statusKey = rawStatus.toUpperCase();

  if (!(isStatusKey(statusKey))) {
    throw new Error(`Invalid status: "${line}"`);
  }

  return { time, status: statusKey };
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

  let prevTime = "00:00";
  let prevMinutes = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const { time, status } = parseLine(line);
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
    duration['O'] += 1440 - prevMinutes;

    result.push({
      startTime: prevTime,
      endTime: "24:00",
      status: "OFF_DUTY",
    });
  }

  console.log("Calculated Duration:", duration);

  return {
    value: result,
    duration: duration,
    error: null,
  }
}