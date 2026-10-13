import { expect, test } from "vitest";
import { parseLogs } from "~/libs/hos-log-normalizer";

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
