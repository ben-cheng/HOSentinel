import { expect, test } from "vitest";
import { parseLogs } from "./hos-log-normalizer";
import {
  addStatusAt,
  moveNode,
  removeNode,
  toLogText,
  toTimelineIntervals,
} from "./hos-timeline-edit";

const now = new Date(2026, 9, 14, 10, 0);
const load = (log: string) =>
  toTimelineIntervals(
    parseLogs(log, { date: "2026-10-13", now, expectedDate: "2026-10-13" })
      .value,
  );

test("adds a status before the click inside a bounded interval", () => {
  expect(toLogText(addStatusAt(load("O0630D0930O"), 405, "N"))).toBe(
    "O0630N0645D0930O",
  );
});

test("ignores a click with the same status", () => {
  expect(toLogText(addStatusAt(load("O0630D0930O"), 405, "D"))).toBe(
    "O0630D0930O",
  );
});

test("adds a status after the click inside the open-ended interval", () => {
  expect(toLogText(addStatusAt(load("O0630N0645D"), 570, "O"))).toBe(
    "O0630N0645D0930O",
  );
});

test("removes a node", () => {
  expect(toLogText(removeNode(load("O0630N0645D0930O"), 1))).toBe(
    "O0630D0930O",
  );
});

test("moves a node within its neighbours", () => {
  const intervals = load("O0630D0930O");
  expect(toLogText(moveNode(intervals, 0, 480))).toBe("O0800D0930O");
  expect(toLogText(moveNode(intervals, 0, 600))).toBe("O0915D0930O");
});

test("writes a non-Off-Duty final interval to 24:00", () => {
  expect(toLogText(load("O0630D2400"))).toBe("O0630D2400");
});
