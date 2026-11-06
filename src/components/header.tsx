import { component$ } from "@qwik.dev/core";

export const Header = component$(() => (
  <header class="mb-5 text-center sm:mb-6">
    <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
      HOSentinel
    </h1>
    <p class="mt-1 text-sm font-semibold text-blue-700">Hours of Service</p>
  </header>
));