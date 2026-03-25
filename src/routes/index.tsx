import { component$, useSignal, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { parseLogs } from "~/libs/hos-log-normalizer";
import { DutyEntry } from "~/models/duty-entry";
import { createEmptyStatusDuration, STATUS_LABEL, STATUS_MAP, StatusDuration } from "~/models/duty-status";

export default component$(() => {
  const input = useSignal("");
  const result = useSignal<DutyEntry[]>([]);
  const calculatedDuration = useSignal<StatusDuration>(createEmptyStatusDuration());
  const error = useSignal<string | null>(null);

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

  return (
    <div class="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 space-y-6">
        
        {/* Title */}
        <div>
          <h1 class="text-2xl font-bold text-gray-800">
            HOS Log Parser
          </h1>
          <p class="text-sm text-gray-500">
            Enter your shift logs (time = end of status)
          </p>
        </div>

        {/* Textarea */}
        <div>
          <textarea
            class="w-full h-48 p-3 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Flexible format supported:

09:34 O
934 N
9:34D
093OO`}
            value={input.value}
            onInput$={(e) =>
              (input.value = (e.target as HTMLTextAreaElement).value)
            }
          />
        </div>

        {/* Button */}
        <div class="flex justify-between items-center">
          <button
            onClick$={handleParse}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Parse Logs
          </button>

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

          <div class="bg-gray-900 text-green-400 text-sm rounded-lg p-4 overflow-auto max-h-64">
            <pre>
              {result.value.length
                ? JSON.stringify(result.value, null, 2)
                : "// No data"}
            </pre>
          </div>

          <div class="bg-gray-900 text-green-400 text-sm rounded-lg p-4 overflow-auto max-h-64">
            <pre>
              {calculatedDuration.value
                ? JSON.stringify(calculatedDuration.value, null, 2)
                : "// No data"}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Welcome to Qwik",
  meta: [
    {
      name: "description",
      content: "Qwik site description",
    },
  ],
};
