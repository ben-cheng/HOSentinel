import { component$ } from "@qwik.dev/core";

export const Footer = component$(() => (
  <footer class="border-t border-slate-100 pt-5 text-center text-xs leading-relaxed text-slate-500">
    Logs are stored only in this browser on this device. They are not synced or
    backed up remotely.
  </footer>
));