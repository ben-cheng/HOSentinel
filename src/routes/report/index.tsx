import { component$ } from "@qwik.dev/core";
import { type DocumentHead } from "@qwik.dev/router";

export default component$(() => (
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-slate-900">
        Cycle report
      </h2>
      <p class="mt-1 text-sm text-slate-600">
        Review your hours of service across your cycle.
      </p>
    </div>
    <section class="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
      <span class="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
        In progress
      </span>
      <h3 class="mt-4 text-lg font-semibold text-slate-900">
        Cycle reporting is not available yet
      </h3>
      <p class="mt-1 text-sm leading-relaxed text-slate-600">
        This report is still in progress.
      </p>
    </section>
  </div>
));

export const head: DocumentHead = {
  title: "Cycle report · HOSentinel",
};
