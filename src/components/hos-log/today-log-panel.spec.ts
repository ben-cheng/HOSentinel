import { expect, test } from "vitest";
import {
  getActiveDutyEntry,
  parseLogs,
} from "~/components/hos-log/hos-log-normalizer";
import type { DutyEntry } from "~/models/duty-entry";

const entries: DutyEntry[] = [
  {
    startTime: "00:00",
    endTime: "06:35",
    status: "OFF_DUTY",
  },
  {
    startTime: "06:35",
    endTime: "09:00",
    status: "DRIVING",
  },
  {
    startTime: "09:00",
    endTime: "24:00",
    status: "ON_DUTY_NOT_DRIVING",
  },
];

test("returns the duty status active at the current minute", () => {
  expect(getActiveDutyEntry(entries, 6 * 60 + 34)).toBe(entries[0]);
  expect(getActiveDutyEntry(entries, 6 * 60 + 35)).toBe(entries[1]);
  expect(getActiveDutyEntry(entries, 12 * 60)).toBe(entries[2]);
});

test("returns no active status when the log has no intervals", () => {
  expect(getActiveDutyEntry([], 600)).toBeUndefined();
});
