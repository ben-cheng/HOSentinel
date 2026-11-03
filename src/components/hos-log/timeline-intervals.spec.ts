import { expect, test } from "vitest";
import { parseLogs } from "./hos-log-normalizer";
import { toLogText, toTimelineIntervals } from "./timeline-intervals";

const now = new Date(2026, 9, 14, 10, 0);
const load = (log: string) =>
  toTimelineIntervals(
    parseLogs(log, { date: "2026-10-13", now, expectedDate: "2026-10-13" })
      .value,
  );

test("round-trips a log through intervals", () => {
  expect(toLogText(load("O0630N0645D0930O"))).toBe("O0630N0645D0930O");
});

test("writes a non-Off-Duty final interval to 24:00", () => {
  expect(toLogText(load("O0630D2400"))).toBe("O0630D2400");
});
