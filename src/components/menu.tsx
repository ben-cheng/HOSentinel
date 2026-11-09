import { component$ } from "@qwik.dev/core";
import { NavLink } from "./nav-link";

export const Menu = component$(() => (
  <nav aria-label="Main navigation" class="flex flex-wrap justify-center gap-2">
    <NavLink
      href={`${import.meta.env.BASE_URL}today/`}
      class="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      activeClass="bg-blue-700 text-white hover:bg-blue-800"
    >
      Today Log
    </NavLink>
    <NavLink
      href={`${import.meta.env.BASE_URL}history/`}
      class="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      activeClass="bg-blue-700 text-white hover:bg-blue-800"
    >
      Log history
    </NavLink>
    <NavLink
      href={`${import.meta.env.BASE_URL}report/`}
      class="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      activeClass="bg-blue-700 text-white hover:bg-blue-800"
    >
      Cycle report
    </NavLink>
  </nav>
));