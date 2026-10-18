import { expect, test } from "vitest";
import { updateLogForStatus } from "~/components/hos-log/hos-log-status-updater";
import {
  getActiveDutyEntry,
  parseLogs,
} from "~/components/hos-log/hos-log-normalizer";

const at = (hour: number, minute: number) =>
  new Date(2026, 9, 14, hour, minute);

test("selecting the active status is a no-op", () => {
  expect(updateLogForStatus("O0630\nD", "D", at(7, 15))).toBe(
    "O0630\nD",
  );
});

test("same-minute status corrections replace the final status", () => {
  expect(updateLogForStatus("O0630\nD", "N", at(6, 30))).toBe(
    "20261014\nO0630\nN",
  );
});

test("same all-day status remains unchanged", () => {
  expect(updateLogForStatus("O", "O", at(7, 15))).toBe("O");
});

test("status changes create status-first intervals with a date header", () => {
  expect(updateLogForStatus("O0630\nD", "N", at(7, 15))).toBe(
    "20261014\nO0630\nD0715\nN",
  );
});

test("legacy transitions are migrated when a status is changed", () => {
  expect(updateLogForStatus("O\n0630D", "N", at(6, 30))).toBe(
    "20261014\nO0630\nN",
  );
});

test("the active duty interval reflects a button status change", () => {
  const log = updateLogForStatus("O0630\nD", "N", at(7, 15));
  const entries = parseLogs(log, { now: at(7, 15) }).value;
  const active = getActiveDutyEntry(entries, 7 * 60 + 15);

  expect(active?.status).toBe("ON_DUTY_NOT_DRIVING");
  expect(active?.startTime).toBe("07:15");
});

test("same-status button presses do not rewrite redundant existing entries", () => {
  const log = "O1931\nN1942\nO1946\nO";
  expect(updateLogForStatus(log, "O", at(19, 53))).toBe(log);
});
