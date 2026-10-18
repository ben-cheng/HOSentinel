import { createContextId, type Signal } from "@builder.io/qwik";

export type DutyStatus =
  | "OFF_DUTY"
  | "SLEEPER"
  | "DRIVING"
  | "ON_DUTY_NOT_DRIVING";

export type StatusKey = "O" | "S" | "D" | "N";

export type StatusDuration = Record<StatusKey, number>;

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

export function createEmptyStatusDuration(): StatusDuration {
  return Object.fromEntries(
    Object.keys(STATUS_MAP).map((key) => [key, 0]),
  ) as StatusDuration;
}

export type DutyEntry = {
  startTime: string;
  endTime: string;
  status: DutyStatus;
  remarks?: string;
};

export type LogEntry = {
  status: DutyStatus;
  endMinute: number | null;
};

export type DailyLog = {
  date: string;
  entries: LogEntry[];
  completedAt: string | null;
};

export type DailyBreakdown = {
  intervals: {
    status: DutyStatus;
    startMinute: number;
    endMinute: number;
  }[];
  minutesByStatus: Record<DutyStatus, number>;
};

export const HosContext = createContextId<Signal<DailyLog>>("HosContext");
