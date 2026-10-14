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
            ? "space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4"
            : "rounded-lg border border-blue-200 bg-blue-50 p-4"
        }
      >
        <h3
          class={
            isCard
              ? "text-sm font-semibold text-blue-700"
              : "mb-3 text-sm font-semibold text-blue-700"
          }
        >
          Duration Breakdown
        </h3>
        <div class="space-y-2">
          {(Object.keys(STATUS_LABEL) as StatusKey[]).map((status) => (
            <div
              key={status}
              class={
                isCard
                  ? "flex items-center justify-between text-sm"
                  : "flex justify-between text-sm"
              }
            >
              <span class="text-gray-700">{STATUS_LABEL[status]}</span>
              <span class="font-semibold text-blue-800">
                {Number((roundedCents[status] / 100).toFixed(2))} h
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  },
);
