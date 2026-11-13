import { getLocalDateKey } from "./date-utils";
import { endsAtEndOfDay, formatDailyLog, parseLogs } from "./hos-log-normalizer";
import type { HosLogRecord } from "./context/hos-storage-provider";

export function selectBackupRecords(
  records: HosLogRecord[],
  from: string,
  through: string,
): HosLogRecord[] {
  if (from && through && from > through) {
    throw new Error("The start date must be on or before the end date.");
  }
  return records.filter(
    (record) =>
      (!from || record.date >= from) && (!through || record.date <= through),
  );
}

function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && !Number.isNaN(Date.parse(value))
  );
}

function completePastDay(entries: string[]): string[] {
  if (endsAtEndOfDay(entries)) return entries;
  const result = [...entries];
  const last = result.at(-1);
  if (last && /^[OSDN]$/.test(last)) {
    result[result.length - 1] = `${last}2400`;
  } else {
    result.push("O2400");
  }
  return result;
}

export function parseBackup(text: string, importedAt: string): HosLogRecord[] {
  const importTime = new Date(importedAt);
  if (!isTimestamp(importedAt) || Number.isNaN(importTime.getTime())) {
    throw new Error("Invalid import timestamp.");
  }
  const today = getLocalDateKey(importTime);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const records: HosLogRecord[] = [];
  const dates = new Set<string>();

  for (const [index, rawLine] of lines.entries()) {
    if (!rawLine.trim()) continue;
    try {
      const fields = rawLine.split("\t");
      if (fields.length !== 1 && fields.length !== 3) {
        throw new Error(
          "Expected a log, optionally followed by two tab-separated timestamps.",
        );
      }
      const log = fields[0].trim();
      if (!/^(?:\d{8}|\d{4}-\d{2}-\d{2})[A-Za-z]/.test(log)) {
        throw new Error("A date header and status are required.");
      }
      const legacyUpdatedAt = fields.length === 3 ? fields[1] : null;
      const legacyCompletedAt = fields.length === 3 ? fields[2] || null : null;
      if (
        (legacyUpdatedAt !== null && !isTimestamp(legacyUpdatedAt)) ||
        (legacyCompletedAt && !isTimestamp(legacyCompletedAt))
      ) {
        throw new Error("Invalid timestamp.");
      }
      const parsed = parseLogs(log, { now: importTime });
      if (dates.has(parsed.date))
        throw new Error(`Duplicate date ${parsed.date}.`);
      const previous = records.at(-1);
      if (previous && parsed.date < previous.date) {
        throw new Error("Dates must be in ascending order (oldest first).");
      }
      dates.add(parsed.date);
      const entries =
        parsed.date < today
          ? completePastDay(parsed.canonicalEntries)
          : parsed.canonicalEntries;
      // The backup does not contain a closing time; midnight is a marker, not
      // the original closing time, and cannot match a valid timed entry.
      const completedAt =
        parsed.date === today && endsAtEndOfDay(entries)
          ? new Date(`${parsed.date}T00:00:00`).toISOString()
          : null;
      records.push({
        date: parsed.date,
        logText: formatDailyLog(parsed.date, entries).replace(
          /\s/g,
          "",
        ),
        updatedAt: importedAt,
        completedAt,
      });
    } catch (error) {
      throw new Error(
        `Line ${index + 1}: ${error instanceof Error ? error.message : "Invalid record."}`,
      );
    }
  }
  if (!records.length) throw new Error("The backup contains no log records.");
  return records;
}

export function formatBackup(records: HosLogRecord[], now = new Date()): string {
  const today = getLocalDateKey(now);
  return (
    [...records]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((record) => {
        const parsed = parseLogs(record.logText, {
          date: record.date,
          expectedDate: record.date,
          now,
        });
        if (!parsed.canonicalEntries.length) {
          throw new Error(`Cannot export invalid record for ${record.date}.`);
        }
        const entries =
          parsed.date < today
            ? completePastDay(parsed.canonicalEntries)
            : parsed.canonicalEntries;
        return formatDailyLog(parsed.date, entries).replace(/\s/g, "");
      })
      .join("\n") + "\n"
  );
}
