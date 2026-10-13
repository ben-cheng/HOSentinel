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
