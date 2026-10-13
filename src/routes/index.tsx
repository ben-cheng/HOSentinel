import { component$, useSignal, $, useTask$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { parseLogs } from "~/libs/hos-log-normalizer";
import { DutyEntry } from "~/models/duty-entry";
import { createEmptyStatusDuration, isStatusKey, STATUS_LABEL, STATUS_MAP, StatusDuration } from "~/models/duty-status";

export default component$(() => {
  const input = useSignal("O");
  const result = useSignal<DutyEntry[]>([]);
  const calculatedDuration = useSignal<StatusDuration>(createEmptyStatusDuration());
  const error = useSignal<string | null>(null);

  const addStatusEntry = $((status: "O" | "D" | "N") => {
    const lines = input.value.split("\n");
    let previousLineIndex = lines.length - 1;
    while (previousLineIndex >= 0 && !lines[previousLineIndex].trim()) {
      previousLineIndex--;
    }
    const previousLine = lines[previousLineIndex]?.replace(/\s+/g, "");

    if (previousLine?.length === 1 && previousLine.toUpperCase() === status) {
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const transitionEntry = previousLine?.match(/^(\d{1,2}:?\d{2})([A-Za-z])$/);
    const intervalEndEntry = previousLine?.match(/^([A-Za-z])(\d{1,2}:?\d{2})$/);
    const previousStatus = transitionEntry?.[2] ?? intervalEndEntry?.[1];
    const previousTimeRaw = transitionEntry?.[1] ?? intervalEndEntry?.[2];
    const previousTimeFirst = Boolean(transitionEntry);

    if (
      previousStatus &&
      previousTimeRaw &&
      isStatusKey(previousStatus.toUpperCase())
    ) {
      const previousTime = previousTimeRaw.replace(":", "").padStart(4, "0");

      if (previousTime === time) {
        lines[previousLineIndex] = previousTimeFirst
          ? `${previousTimeRaw}${status}`
          : `${status}${previousTimeRaw}`;
        input.value = lines.join("\n");
        return;
      }

      if (previousStatus.toUpperCase() === status) {
        lines[previousLineIndex] = previousTimeFirst
          ? `${time}${status}`
          : `${status}${time}`;
        input.value = lines.join("\n");
        return;
      }
    }

    const separator = input.value.trim() ? "\n" : "";
    input.value = `${input.value.trimEnd()}${separator}${time}${status}`;
  });

  const handleParse = $(() => {
    error.value = null;

    try {
      const { duration, value, error: err } = parseLogs(input.value);

      calculatedDuration.value = duration;
      result.value = value;
      error.value = err;
    } catch (e: any) {
      result.value = [];
      error.value = e.message || "Failed to parse logs";
    }
  });

  useTask$(({ track, cleanup }) => {
    track(() => input.value);
    const id = setTimeout(() => {
      handleParse();
    }, 500);
    cleanup(() => {
      clearTimeout(id);
      // Cleanup logic if needed
    });
  });

  return (
    <div class="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6">
        
        {/* Title */}
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            HOS Log Parser
          </h1>
          <p class="text-sm text-gray-500">
            Enter status changes. A timestamp followed by a status starts that status at the given time; spaces are ignored. The day defaults to Off-duty (O).
          </p>
        </div>

        {/* Textarea */}
        <div>
          <textarea
            class="w-full h-48 p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Timestamp + status starts a status at that time:

O
0104D

Or use status + interval end times:

O630N645D900O

or one entry per line:
O630
N645
D900
O`}
            value={input.value}
            onInput$={(e) =>
              (input.value = (e.target as HTMLTextAreaElement).value)
            }
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            onClick$={() => addStatusEntry("O")}
          >
            Off-duty
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick$={() => addStatusEntry("D")}
          >
            Driving
          </button>
          <button
            type="button"
            class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            onClick$={() => addStatusEntry("N")}
          >
            On-duty not driving
          </button>
        </div>

        <div class="flex justify-between items-center min-h-6">
          {error.value && (
            <span class="text-sm text-red-500">{error.value}</span>
          )}
        </div>

        {/* Result */}
        <div>
          <h2 class="text-lg font-semibold text-gray-700 mb-2">
            Parsed Output
          </h2>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 class="text-sm font-semibold text-blue-700">
              Duration Breakdown
            </h3>

            <div class="space-y-2">
              {Object.entries(calculatedDuration.value).map(([key, minutes]) => {
                const hours = Number((minutes / 60).toFixed(2));

                return (
                  <div
                    key={key}
                    class="flex justify-between items-center text-sm"
                  >
                    <span class="text-gray-700">
                      {STATUS_LABEL[key as keyof typeof STATUS_MAP]}
                    </span>

                    <span class="font-semibold text-blue-800">
                      {hours} h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "HOSentinel",
  meta: [
    {
      name: "description",
      content: "An app to help drivers fill out their HOS logs",
    },
  ],
};
