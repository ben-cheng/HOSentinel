import { type Signal } from "@builder.io/qwik";
import { createContextId } from "@builder.io/qwik";

export type DutyStatus = "offDuty" | "sleeper" | "driving" | "onDutyNotDriving";

export type LogEntry = {
  status: DutyStatus;
  endMinute: number | null; // minutes after midnight; null means temporary/current
};

export type DailyLog = {
  date: string; // local YYYY-MM-DD
  entries: LogEntry[];
  completedAt: string | null; // ISO timestamp; null means the day is in progress
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
