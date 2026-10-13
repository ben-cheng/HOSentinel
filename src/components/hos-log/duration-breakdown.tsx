import { component$ } from "@builder.io/qwik";
import { STATUS_LABEL, StatusDuration, StatusKey } from "~/models/duty-status";

interface DurationBreakdownProps {
  duration: StatusDuration;
  variant?: "card" | "section";
}

export const DurationBreakdown = component$(
  ({ duration, variant = "card" }: DurationBreakdownProps) => {
    const isCard = variant === "card";

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
                {Number((duration[status] / 60).toFixed(2))} h
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  },
);
