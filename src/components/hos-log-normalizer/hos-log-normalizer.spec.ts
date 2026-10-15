import { expect, test } from "vitest";
import {
  endsAtEndOfDay,
  finalizeCompletedLogEntries,
  formatDailyLog,
  getActiveDutyEntry,
  getElapsedDuration,
  getFinalStatus,
  parseLogs,
  reopenCompletedLogEntries,
} from "~/libs/hos-log-normalizer";

const now = new Date(2026, 9, 14, 10, 0);
const today = "2026-10-14";
const yesterday = "2026-10-13";

test("calculates elapsed duration for today's temporary status", () => {
  const { duration } = parseLogs(
    "20261014\nO0600\nn0630\nd0900",
    { now },
  );

  expect(duration).toEqual({ O: 420, S: 0, D: 150, N: 30 });
});

test("calculates a full day for dated historical status-first entries", () => {
  const { duration } = parseLogs("O 630 N 645 D 900 O", {
    date: yesterday,
    now,
  });

  expect(duration).toEqual({
    O: 1290,
    S: 0,
    D: 135,
    N: 15,
  });
});

test("a standalone status is temporary for today", () => {
  const { duration, value } = parseLogs("D", { date: today, now });

  expect(duration).toEqual({ O: 0, S: 0, D: 600, N: 0 });
  expect(getActiveDutyEntry(value, 10 * 60)?.status).toBe("DRIVING");
});

test("a temporary status on a past day lasts through midnight", () => {
  const { duration, value } = parseLogs("D", { date: yesterday, now });

  expect(duration).toEqual({ O: 0, S: 0, D: 1440, N: 0 });
  expect(value).toEqual([
    { startTime: "00:00", endTime: "24:00", status: "DRIVING" },
  ]);
});

test("legacy timestamp-first entries migrate to status-first intervals", () => {
  const parsed = parseLogs("O\n0104D", { date: yesterday, now });

  expect(parsed.wasLegacy).toBe(true);
  expect(parsed.canonicalEntries).toEqual(["O0104", "D"]);
  expect(parsed.duration).toEqual({ O: 64, S: 0, D: 1376, N: 0 });
  expect(parsed.value).toEqual([
    { startTime: "00:00", endTime: "01:04", status: "OFF_DUTY" },
    { startTime: "01:04", endTime: "24:00", status: "DRIVING" },
  ]);
});

test("legacy input without an initial status gets an Off-duty interval", () => {
  const parsed = parseLogs("0630D\n0900N", { date: yesterday, now });

  expect(parsed.canonicalEntries).toEqual(["O0630", "D0900", "N"]);
});

test("reads and writes compact date-prefixed canonical logs", () => {
  const parsed = parseLogs("20261013O0630N0645D0900", { now });

  expect(parsed.date).toBe(yesterday);
  expect(parsed.canonicalEntries).toEqual(["O0630", "N0645", "D0900"]);
  expect(formatDailyLog(parsed.date, parsed.canonicalEntries)).toBe(
    "20261013\nO0630\nN0645\nD0900",
  );
});

test("rejects a date header that does not match the selected record", () => {
  expect(() =>
    parseLogs("20261013\nO", { date: today, expectedDate: today, now }),
  ).toThrow(/does not match selected day/);
});

test("merges adjacent duplicate statuses when normalizing tokens", () => {
  const parsed = parseLogs("O1931\nN1942\nO1946\nO", {
    date: yesterday,
    now,
  });

  expect(parsed.canonicalEntries).toEqual(["O1931", "N1942", "O"]);
  expect(parsed.value).toEqual([
    { startTime: "00:00", endTime: "19:31", status: "OFF_DUTY" },
    { startTime: "19:31", endTime: "19:42", status: "ON_DUTY_NOT_DRIVING" },
    { startTime: "19:42", endTime: "24:00", status: "OFF_DUTY" },
  ]);
});

test("elapsed breakdown clips entries at the current local time", () => {
  const entries = parseLogs("O0600\nD1200\nN1800", {
    date: yesterday,
    now,
  }).value;

  expect(getElapsedDuration(entries, 10 * 60)).toEqual({
    O: 360,
    S: 0,
    D: 240,
    N: 0,
  });
});

test("completed days count remaining time as Off-duty", () => {
  const parsed = parseLogs("20261014\nD", {
    date: today,
    now,
    completedAt: "2026-10-14T10:00:00",
  });

  expect(parsed.duration).toEqual({ O: 840, S: 0, D: 600, N: 0 });
  expect(getActiveDutyEntry(parsed.value, 10 * 60)?.status).toBe("OFF_DUTY");
});

test("a completed historical day retains its Off-duty remainder", () => {
  const parsed = parseLogs("20261013\nD", {
    date: yesterday,
    now,
    completedAt: "2026-10-13T10:00:00",
  });

  expect(parsed.duration).toEqual({ O: 840, S: 0, D: 600, N: 0 });
});

test("finalizes a completed temporary status and closes the log at 2400", () => {
  expect(
    finalizeCompletedLogEntries(
      ["O0600", "D"],
      "2026-10-14T10:00:00",
    ),
  ).toEqual(["O0600", "D1000", "O2400"]);
});

test("recognizes a final timed 2400 entry as the end of the day", () => {
  expect(endsAtEndOfDay(["O0600", "D2400"])).toBe(true);
  expect(endsAtEndOfDay(["O0600", "D"])).toBe(false);
  expect(endsAtEndOfDay(["O2400", "D"])).toBe(false);
});

test("finalizes an already-ended status with an Off-duty 2400 boundary", () => {
  expect(
    finalizeCompletedLogEntries(
      ["O0600", "D0900"],
      "2026-10-14T10:00:00",
    ),
  ).toEqual(["O0600", "D0900", "O2400"]);
});

test("reopening removes the generated 2400 closure and restores the temporary status", () => {
  expect(
    reopenCompletedLogEntries(
      ["O0600", "D1000", "O2400"],
      "2026-10-14T10:00:00",
    ),
  ).toEqual(["O0600", "D"]);
});

test("reopening a log whose final duty status ends at 2400 makes it temporary", () => {
  expect(
    reopenCompletedLogEntries(["O0600", "D2400"], "2026-10-14T10:00:00"),
  ).toEqual(["O0600", "D"]);
});

test("gets the status to carry into the next day", () => {
  const previousDay = parseLogs("O\n0630D\n0900N\n1200S", {
    date: yesterday,
    now,
  });

  expect(getFinalStatus(previousDay.value)).toBe("S");
});
