import { expect, test } from "vitest";
import { buildHistoryItems } from "./history-items";

const record = (date: string, logText: string) => ({
  date,
  logText,
  updatedAt: "",
  completedAt: null,
});

test("lists every day from the first record through maxDate, newest first", () => {
  const items = buildHistoryItems(
    [record("2026-10-10", "O0600D"), record("2026-10-13", "O0700O")],
    "2026-10-13",
  );
  expect(items.map((item) => item.date)).toEqual([
    "2026-10-13",
    "2026-10-12",
    "2026-10-11",
    "2026-10-10",
  ]);
  expect(items.map((item) => item.hasRecord)).toEqual([true, false, false, true]);
});

test("includes yesterday even when it has no record", () => {
  const items = buildHistoryItems([record("2026-10-10", "O0600O")], "2026-10-12");
  expect(items[0]).toMatchObject({ date: "2026-10-12", hasRecord: false });
});

test("carries the previous final status into empty days", () => {
  const items = buildHistoryItems([record("2026-10-10", "O0600D")], "2026-10-11");
  expect(items[0].log).toContain("D");
});

test("ignores records after maxDate and returns [] when none remain", () => {
  expect(buildHistoryItems([record("2026-10-14", "O")], "2026-10-13")).toEqual([]);
});
