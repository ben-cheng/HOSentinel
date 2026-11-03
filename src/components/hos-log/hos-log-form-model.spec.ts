import { expect, test } from "vitest";
import {
  formModelToLog,
  insertRowBefore,
  logToFormModel,
  validateLog,
} from "./hos-log-form-model";

test("converts a log into rows with a trailing status", () => {
  const model = logToFormModel("O0630N0645D0930O");
  expect(model.rows).toEqual([
    { status: "O", until: "06:30" },
    { status: "N", until: "06:45" },
    { status: "D", until: "09:30" },
  ]);
  expect(model.trailing).toBe("O");
});

test("round-trips rows back to a log", () => {
  const model = logToFormModel("O0630N0645D0930O");
  expect(logToFormModel(formModelToLog(model))).toEqual(model);
});

test("validates logs", () => {
  expect(validateLog("O0630D0930O")).toBeNull();
  expect(validateLog("O0900D0800O")).toBeTruthy();
});

test("inserts a row between two rows, splitting the gap", () => {
  const model = insertRowBefore(logToFormModel("O0600D1000O"), 1);
  expect(model.rows.map((row) => row.until)).toEqual(["06:00", "08:00", "10:00"]);
  expect(model.rows[1].status).toBe("D");
});

test("inserts at the start and the end", () => {
  const model = logToFormModel("O0600D");
  expect(insertRowBefore(model, 0).rows[0].until).toBe("03:00");
  expect(insertRowBefore(model, 1).rows[1].until).toBe("15:00");
});

test("does not insert when there is no gap", () => {
  const model = logToFormModel("O0600D0601O");
  expect(insertRowBefore(model, 1)).toBe(model);
});

test("distinguishes a final status running until now from end of day", () => {
  const running = logToFormModel("O0600D");
  expect(running.trailingUntil).toBe("now");
  const ended = logToFormModel("O0600D2400");
  expect(ended).toMatchObject({ trailing: "D", trailingUntil: "end" });
  expect(ended.rows).toHaveLength(1);
  expect(formModelToLog(ended, { isToday: true })).toContain("D2400");
  expect(formModelToLog(running, { isToday: true })).not.toContain("2400");
  expect(formModelToLog(ended, { isToday: false })).not.toContain("2400");
});
