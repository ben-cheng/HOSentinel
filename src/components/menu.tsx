import { component$ } from "@qwik.dev/core";
import { NavLink } from "./nav-link";

export const Menu = component$(() => (
    <nav class="mt-3 flex gap-4 text-sm font-semibold text-blue-700">
        <NavLink href="/today/" activeClass="text-cyan-500">Today Log</NavLink>
        <NavLink href="/history/" activeClass="text-cyan-500">Log history</NavLink>
        <NavLink href="/report/" activeClass="text-cyan-500">Cycle report</NavLink>
    </nav>
));