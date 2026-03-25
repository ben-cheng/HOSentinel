export type DutyStatus =
  | "OFF_DUTY"
  | "SLEEPER"
  | "DRIVING"
  | "ON_DUTY_NOT_DRIVING";

export type StatusKey = 
  | "O"
  | "S"
  | "D"
  | "N";

export const STATUS_MAP: Record<StatusKey, DutyStatus> = {
  O: "OFF_DUTY",
  S: "SLEEPER",
  D: "DRIVING",
  N: "ON_DUTY_NOT_DRIVING",
} as const;

export function isStatusKey(value: string): value is StatusKey {
  return value in STATUS_MAP;
}

export const STATUS_LABEL: Record<StatusKey, string> = {
  O: "Off Duty",
  S: "Sleeper",
  D: "Driving",
  N: "On Duty (Not Driving)",
};

export type StatusDuration = Record<StatusKey, number>;

export function createEmptyStatusDuration(): StatusDuration {
  return Object.fromEntries(
    Object.keys(STATUS_MAP).map((key) => [key, 0])
  ) as StatusDuration;
}