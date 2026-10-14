import { expect, test } from "vitest";
import { getRoundedDurationCents } from "./duration-breakdown";

test("rounds displayed status durations while preserving the daily total", () => {
  const roundedCents = getRoundedDurationCents({
    O: 1437,
    S: 1,
    D: 1,
    N: 1,
  });

  expect(roundedCents).toEqual({
    O: 2395,
    S: 2,
    D: 2,
    N: 1,
  });
  expect(
    Object.values(roundedCents).reduce((total, cents) => total + cents, 0),
  ).toBe(2400);
});

test("preserves exact durations when they are whole hours", () => {
  expect(
    getRoundedDurationCents({
      O: 1260,
      S: 0,
      D: 150,
      N: 30,
    }),
  ).toEqual({
    O: 2100,
    S: 0,
    D: 250,
    N: 50,
  });
});
