import { expect, test } from "vitest";
import { updateLogForStatus } from "~/libs/hos-log-status-updater";
import { getActiveDutyEntry, parseLogs } from "~/libs/hos-log-normalizer";

const at = (hour: number, minute: number) =>
  new Date(2026, 9, 14, hour, minute);

test("repeated current status does not add a redundant interval", () => {
  expect(updateLogForStatus("O0630\nD", "D", at(7, 15))).toBe("O0630\nD");
});

test("same-minute status corrections replace the final status", () => {
  expect(updateLogForStatus("O0630\nD", "N", at(6, 30))).toBe(
    "O0630\nN",
  );
});

test("same all-day status remains unchanged", () => {
  expect(updateLogForStatus("O", "O", at(7, 15))).toBe("O");
});

test("a different status appends a timestamp-first transition", () => {
  expect(updateLogForStatus("O0630\nD", "N", at(7, 15))).toBe(
    "O0630\nD0715\nN",
  );
});

test("same-minute transitions replace the existing transition status", () => {
  expect(updateLogForStatus("O\n0630D", "N", at(6, 30))).toBe(
    "O0630\nN",
  );
});

test("the active duty interval reflects every status-button change", () => {
  const log = updateLogForStatus("O0630\nD", "N", at(7, 15));
  const entries = parseLogs(log).value;
  const active = getActiveDutyEntry(entries, 7 * 60 + 15);

  expect(active?.status).toBe("ON_DUTY_NOT_DRIVING");
  expect(active?.startTime).toBe("07:15");
});

test("removes duplicate adjacent status entries from existing records", () => {
  expect(
    updateLogForStatus(
      "O1931\nN1942\nO1946\nO",
      "O",
      at(19, 53),
    ),
  ).toBe("O1931\nN1942\nO");
});
