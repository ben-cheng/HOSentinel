import { expect, test } from "vitest";
import {
  formatLogEntries,
  getFinalStatus,
  getDurationWithOffDutyRemainder,
  parseLogs,
} from "~/libs/hos-log-normalizer";

test("calculates durations for status-first end-time entries", () => {
  const { duration } = parseLogs("O0600\nn0630\nd0900");

  expect(
    Object.fromEntries(
      Object.entries(duration).map(([status, minutes]) => [
        status,
        minutes / 60,
      ]),
    ),
  ).toEqual({
    O: 21,
    S: 0,
    D: 2.5,
    N: 0.5,
  });
});

test("parses compact entries with whitespace ignored", () => {
  const { duration } = parseLogs("O 630 N 645 D 900 O");

  expect(duration).toEqual({
    O: 1290,
    S: 0,
    D: 135,
    N: 15,
  });
});

test("a standalone status applies for the entire day", () => {
  const { duration } = parseLogs("O");

  expect(duration).toEqual({
    O: 1440,
    S: 0,
    D: 0,
    N: 0,
  });
});

test("a timestamp followed by a status starts that status at the given time", () => {
  const { duration, value } = parseLogs("O\n0104D");

  expect(duration).toEqual({
    O: 64,
    S: 0,
    D: 1376,
    N: 0,
  });
  expect(value).toEqual([
    { startTime: "00:00", endTime: "01:04", status: "OFF_DUTY" },
    { startTime: "01:04", endTime: "24:00", status: "DRIVING" },
  ]);
});

test("formats readable lines that compact into one saved log value", () => {
  const { value } = parseLogs("O\n0630D\n0645N\n0900O");
  const displayLines = formatLogEntries(value);

  expect(displayLines).toEqual(["O0630", "D0645", "N0900", "O"]);
  expect(displayLines.join("")).toBe("O0630D0645N0900O");
  expect(parseLogs(displayLines.join("")).duration).toEqual(
    parseLogs("O\n0630D\n0645N\n0900O").duration,
  );
});

test("merges adjacent intervals with the same status", () => {
  const parsed = parseLogs("O1931\nN1942\nO1946\nO");

  expect(parsed.value).toEqual([
    { startTime: "00:00", endTime: "19:31", status: "OFF_DUTY" },
    { startTime: "19:31", endTime: "19:42", status: "ON_DUTY_NOT_DRIVING" },
    { startTime: "19:42", endTime: "24:00", status: "OFF_DUTY" },
  ]);
  expect(formatLogEntries(parsed.value)).toEqual(["O1931", "N1942", "O"]);
});

test("projects the unfinished remainder of a driving day as off duty", () => {
  const entries = parseLogs("O0600\nD1200\nN1800").value;

  expect(getDurationWithOffDutyRemainder(entries, 10 * 60)).toEqual({
    O: 1200,
    S: 0,
    D: 240,
    N: 0,
  });
});

test("projects all remaining hours as off duty at the start of the day", () => {
  expect(
    getDurationWithOffDutyRemainder(parseLogs("D").value, 0),
  ).toEqual({
    O: 1440,
    S: 0,
    D: 0,
    N: 0,
  });
});

test("gets the status to carry into the next day", () => {
  const previousDay = parseLogs("O\n0630D\n0900N\n1200S");

  expect(getFinalStatus(previousDay.value)).toBe("S");
});
