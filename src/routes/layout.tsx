import { component$, Slot } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";

export default component$(() => (
    <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">

        <div
            class="mx-auto w-full max-w-4xl space-y-8 rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-300/50 sm:p-8"
        >
            <div class="border-b border-slate-100 pb-6">
                <p class="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                    HOSentinel
                </p>
                <h1 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    Hours of Service
                </h1>
                <nav class="mt-3 flex gap-4 text-sm font-semibold text-blue-700">
                    <Link href="/today/">Today Log</Link>
                    <Link href="/history/">Log history</Link>
                    <Link href="/report/">Cycle report</Link>
                </nav>
            </div>
            <Slot />
        </div>

    </div>
));
