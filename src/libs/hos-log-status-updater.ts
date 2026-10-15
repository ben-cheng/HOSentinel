import { isStatusKey } from "~/models/duty-status";
import type { StatusKey } from "~/models/duty-status";

type TimedEntry = {
  status: string;
  time: string;
  timeFirst: boolean;
};

function parseTimedEntry(line: string): TimedEntry | undefined {
  const transition = line.match(/^(\d{1,2}:?\d{2})([A-Za-z])$/);
  const intervalEnd = line.match(/^([A-Za-z])(\d{1,2}:?\d{2})$/);
  const match = transition ?? intervalEnd;
  if (!match) return undefined;

  return transition
    ? { time: match[1], status: match[2], timeFirst: true }
    : { status: match[1], time: match[2], timeFirst: false };
}

function normalizeTime(time: string): string {
  return time.replace(":", "").padStart(4, "0");
}

export function updateLogForStatus(
  input: string,
  status: StatusKey,
  now: Date,
): string {
  const lines = input.split("\n");
  let lastLineIndex = lines.length - 1;
  while (lastLineIndex >= 0 && !lines[lastLineIndex].trim()) {
    lastLineIndex--;
  }

  const lastLine = lines[lastLineIndex]?.replace(/\s+/g, "");
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  if (lastLine?.length === 1) {
    let previousTimedLineIndex = lastLineIndex - 1;
    while (previousTimedLineIndex >= 0) {
      const previous = lines[previousTimedLineIndex].replace(/\s+/g, "");
      const entry = parseTimedEntry(previous);
      if (entry && isStatusKey(entry.status.toUpperCase())) {
        const previousTime = normalizeTime(entry.time);
        if (previousTime === time && lastLine.toUpperCase() !== status) {
          lines[lastLineIndex] = status;
          return lines.join("\n");
        }

        if (lastLine.toUpperCase() === status) {
          if (previousTime === time) return input;
          lines[previousTimedLineIndex] = entry.timeFirst
            ? `${time}${entry.status}`
            : `${entry.status}${time}`;
          return lines.join("\n");
        }
        break;
      }
      previousTimedLineIndex--;
    }

    if (lastLine.toUpperCase() === status) return input;
  }

  const previousEntry =
    lastLine && lastLineIndex >= 0 ? parseTimedEntry(lastLine) : undefined;
  if (
    previousEntry &&
    isStatusKey(previousEntry.status.toUpperCase())
  ) {
    const previousTime = normalizeTime(previousEntry.time);

    if (previousTime === time) {
      lines[lastLineIndex] = previousEntry.timeFirst
        ? `${previousEntry.time}${status}`
        : `${status}${previousEntry.time}`;
      return lines.join("\n");
    }

    if (previousEntry.status.toUpperCase() === status) {
      lines[lastLineIndex] = previousEntry.timeFirst
        ? `${time}${status}`
        : `${status}${time}`;
      return lines.join("\n");
    }
  }

  const separator = input.trim() ? "\n" : "";
  return `${input.trimEnd()}${separator}${time}${status}`;
}
