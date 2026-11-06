import { component$, useComputed$, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { STATUS_OPTIONS, StatusPanel } from "./status-panel";
import type { SelectableStatusKey } from "./status-panel";
import { getActiveDutyEntry, parseLogs } from "./hos-log-normalizer";
import { updateLogForStatus } from "./hos-log-status-updater";
import { getMinuteOfDay } from "./date-utils";
import { getCurrentStatus } from "./hours-of-service";

interface StatusSwitcherProps {
  /** Raw log text of the running day. */
  log: string;
  /** Current time in epoch milliseconds. */
  now: number;
  disabled?: boolean;
  onChange$: QRL<(log: string) => void>;
}

export const StatusSwitcher = component$((props: StatusSwitcherProps) => {
  const active = useComputed$(() => {
    try {
      const parsed = parseLogs(props.log, { now: new Date(props.now) });
      const entry = getActiveDutyEntry(
        parsed.value,
        getMinuteOfDay(new Date(props.now)),
      );
      return {
        status: getCurrentStatus(entry),
        since: entry?.startTime,
      };
    } catch {
      return { status: undefined, since: undefined };
    }
  });

  const select = $(async (status: SelectableStatusKey) => {
    const next = updateLogForStatus(props.log, status, new Date(props.now));
    if (next !== props.log) await props.onChange$(next);
  });

  return (
    <div class="grid grid-cols-3 gap-2 sm:gap-3">
      {STATUS_OPTIONS.map((option) => (
        <StatusPanel
          key={option.status}
          status={option.status}
          label={option.label}
          currentStatus={active.value.status}
          currentSince={active.value.since}
          disabled={props.disabled ?? false}
          onAddStatus={select}
        />
      ))}
    </div>
  );
});
