import { component$ } from "@qwik.dev/core";
import { type DocumentHead } from "@qwik.dev/router";

export default component$(() => (
  <div class="space-y-4">
    <h2 class="text-xl font-bold tracking-tight text-slate-900">
      Cycle report
    </h2>
    <p class="text-sm text-slate-500">This report is still in progress.</p>
  </div>
));

export const head: DocumentHead = {
  title: "Cycle report · HOSentinel",
};
