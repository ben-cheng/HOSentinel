import { component$ } from "@builder.io/qwik";
import {
  STATUS_LABEL,
  STATUS_MAP,
  StatusDuration,
  StatusKey,
} from "~/models/duty-status";

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

export const DurationBreakdown = component$(
  ({ duration, variant = "card" }: DurationBreakdownProps) => {
    const isCard = variant === "card";
    const roundedCents = getRoundedDurationCents(duration);

    return (
      <section
        class={
          isCard
            ? "space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5"
            : "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5"
        }
      >
        <h3
          class={
            isCard
              ? "text-sm font-semibold text-slate-800"
              : "mb-4 text-sm font-semibold text-slate-800"
          }
        >
          Breakdown by status
        </h3>
        <div class="grid grid-cols-4 gap-3">
          {(Object.keys(STATUS_LABEL) as StatusKey[]).map((status) => (
            <div
              key={status}
              class="flex min-h-16 flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center"
            >
              <div class="block w-full text-xs font-medium text-slate-500">
                {STATUS_LABEL[status]}
              </div>
              <div class="block w-full text-lg font-bold tabular-nums text-slate-900">
                {Number((roundedCents[status] / 100).toFixed(2))} h
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },
);
