import { expect, test } from "vitest";
import {
  formModelToLog,
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
