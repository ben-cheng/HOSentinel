import { describe, expect, it } from "vitest";
import { formatBackup, parseBackup, selectBackupRecords } from "./hos-log-backup";
import { parseLogs, reopenCompletedLogEntries } from "./hos-log-normalizer";
import type { HosLogRecord } from "./context/hos-storage-provider";

const now = new Date(2026, 9, 14, 12, 0, 0);
const importedAt = now.toISOString();
const records: HosLogRecord[] = [
  {
    date: "2026-10-13",
    logText: "20261013O0630D0930O",
    updatedAt: "2026-10-13T10:00:00.000Z",
    completedAt: null,
  },
  {
    date: "2026-10-14",
    logText: "20261014D1200O2400",
    updatedAt: "2026-10-14T12:00:00.000Z",
    completedAt: "2026-10-14T12:00:00.000Z",
  },
];

describe("text backups", () => {
  it("selects inclusive dates and supports open-ended ranges", () => {
    expect(selectBackupRecords(records, "", "")).toEqual(records);
    expect(selectBackupRecords(records, "2026-10-13", "2026-10-13")).toEqual([records[0]]);
    expect(selectBackupRecords(records, "2026-10-14", "")).toEqual([records[1]]);
    expect(selectBackupRecords(records, "", "2026-10-13")).toEqual([records[0]]);
    expect(selectBackupRecords(records, "2026-10-15", "2026-10-16")).toEqual([]);
    expect(() => selectBackupRecords(records, "2026-10-14", "2026-10-13")).toThrow(
      "The start date must be on or before the end date.",
    );
  });

  it("exports only raw logs and ends past days at 24:00", () => {
    expect(formatBackup(records, now)).toBe(
      "20261013O0630D0930O2400\n20261014D1200O2400\n",
    );
    expect(formatBackup([{
      ...records[0],
      logText: "20261013D0930",
    }], now)).toBe("20261013D0930O2400\n");
  });

  it("imports past days through 24:00, preserving their final status", () => {
    const result = parseBackup("\uFEFF20261012O0630D\r\n20261013O\r\n", importedAt);
    expect(result.map((record) => record.logText)).toEqual([
      "20261012O0630D2400",
      "20261013O2400",
    ]);
    expect(result.every((record) => record.updatedAt === importedAt && record.completedAt === null)).toBe(true);
  });

  it("treats today's 24:00 log as closed and other endings as ongoing", () => {
    const closed = parseBackup("20261014D0930O2400", importedAt)[0];
    expect(closed.completedAt).toBe(new Date(2026, 9, 14).toISOString());
    const reopened = reopenCompletedLogEntries(
      parseLogs(closed.logText).canonicalEntries,
      closed.completedAt!,
    );
    expect(reopened).toEqual(["D0930"]);
    for (const log of ["20261014O", "20261014D0930O", "20261014D0930"]) {
      expect(parseBackup(log, importedAt)[0].completedAt).toBeNull();
    }
  });

  it("accepts older timestamped backups but exports raw logs only", () => {
    const imported = parseBackup(
      "20261014D0930O2400\t2026-10-14T12:00:00.000Z\t2026-10-14T12:00:00.000Z",
      importedAt,
    );
    expect(formatBackup(imported, now)).toBe("20261014D0930O2400\n");
    expect(imported[0].completedAt).toBeTruthy();
  });

  it.each([
    ["", /no log records/],
    ["O0630D", /Line 1: A date header/],
    ["20260230O", /Line 1: Invalid log date/],
    ["20261013O\n20261013D", /Line 2: Duplicate date/],
    ["20261013O0600D0500O", /Line 1: Time entries/],
    ["20261013O\tbad\t", /Line 1: Invalid timestamp/],
    ["20261013O\t2026-10-13T10:00:00.000Z", /Line 1: Expected/],
  ])("rejects malformed backup %j", (text, error) => {
    expect(() => parseBackup(text, importedAt)).toThrow(error);
  });
});
