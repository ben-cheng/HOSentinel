import { listDateKeys } from "./date-utils";
import {
  formatDailyLog,
  getFinalStatus,
  parseLogs,
} from "./hos-log-normalizer";
import type { HosLogRecord } from "./hos-log-storage";

export interface HistoryItem {
  date: string;
  /** Raw log text for the day (carried-over status when nothing was saved). */
  log: string;
  hasRecord: boolean;
}

/**
 * One item per day from the first saved day through `maxDate` (inclusive),
 * newest first. Days without a record carry over the previous day's final status.
 */
export function buildHistoryItems(
  records: HosLogRecord[],
  maxDate: string,
): HistoryItem[] {
  const past = records.filter((record) => record.date <= maxDate);
  if (!past.length) return [];
  const byDate = new Map(past.map((record) => [record.date, record]));
  const first = past.reduce(
    (min, record) => (record.date < min ? record.date : min),
    past[0].date,
  );

  let carry = "O";
  const items: HistoryItem[] = [];
  for (const date of listDateKeys(first, maxDate)) {
    const record = byDate.get(date);
    try {
      const parsed = parseLogs(record ? record.logText : carry, {
        date,
        completedAt: record?.completedAt,
        expectedDate: date,
      });
      items.push({
        date,
        log: formatDailyLog(date, parsed.canonicalEntries),
        hasRecord: !!record,
      });
      carry = getFinalStatus(parsed.value);
    } catch {
      items.push({ date, log: record?.logText ?? "", hasRecord: !!record });
      carry = "O";
    }
  }
  return items.reverse();
}
