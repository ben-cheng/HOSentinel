import { component$, useComputed$ } from "@qwik.dev/core";
import { STATUS_LABEL, STATUS_MAP } from "./hours-of-service";
import type {
  StatusDuration,
  StatusKey,
} from "~/components/hos-log/hours-of-service";

interface DurationBreakdownProps {
  duration: StatusDuration;
  variant?: "card" | "section";
}

export function getRoundedDurationCents(
  duration: StatusDuration,
): Record<StatusKey, number> {
  const statuses = Object.keys(STATUS_MAP) as StatusKey[];
  const exactCents = statuses.map((status) => (duration[status] * 100) / 60);
  const roundedCents = exactCents.map(Math.floor);
  const targetCents = Math.round(
    exactCents.reduce((total, cents) => total + cents, 0),
  );
  const remainingCents =
    targetCents - roundedCents.reduce((total, cents) => total + cents, 0);
  const fractionalRemainders = exactCents
    .map((cents, index) => ({ index, remainder: cents - roundedCents[index] }))
    .sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; index < remainingCents; index++) {
    roundedCents[fractionalRemainders[index].index]++;
  }

  return Object.fromEntries(
    statuses.map((status, index) => [status, roundedCents[index]]),
  ) as Record<StatusKey, number>;
}

export const DurationBreakdown = component$((props: DurationBreakdownProps) => {
  const isCard = useComputed$(() => (props.variant ?? "card") === "card");
  const roundedCents = useComputed$(() =>
    getRoundedDurationCents(props.duration),
  );

  return (
    <section
      class={
        isCard.value
          ? "space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5"
          : "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5"
      }
    >
      <h3
        class={
          isCard.value
            ? "text-sm font-semibold text-slate-800"
            : "mb-4 text-sm font-semibold text-slate-800"
        }
      >
        Breakdown by status
      </h3>
      <div class="flex flex-wrap gap-3">
        {(Object.keys(STATUS_LABEL) as StatusKey[]).map((status) => (
          <div
            key={status}
            class="flex min-h-16 min-w-32 basis-2/5 flex-1 flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
          >
            <div class="block w-full text-xs font-medium text-slate-500">
              {STATUS_LABEL[status]}
            </div>
            <div class="w-fit whitespace-nowrap text-lg font-bold tabular-nums text-slate-900">
              {Number((roundedCents.value[status] / 100).toFixed(2))} h
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});
