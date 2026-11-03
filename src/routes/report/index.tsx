import { component$ } from "@qwik.dev/core";
import { Link, type DocumentHead } from "@qwik.dev/router";

export default component$(() => (
  <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
    <div class="mx-auto w-full max-w-4xl space-y-4 rounded-3xl border border-white/80 bg-white p-6 shadow-xl shadow-slate-300/50">
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">
          Cycle report
        </h1>
        <Link
          href="/"
          class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to today
        </Link>
      </div>
      <p class="text-sm text-slate-500">This report is still in progress.</p>
    </div>
  </div>
));

export const head: DocumentHead = {
  title: "Cycle report · HOSentinel",
};
