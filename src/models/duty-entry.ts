import { DutyStatus } from "./duty-status";

export type DutyEntry = {
    startTime: string;
    endTime: string;
    status: DutyStatus;
    remarks?: string;
}