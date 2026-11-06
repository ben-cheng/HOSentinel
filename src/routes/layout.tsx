import { component$, Slot } from "@qwik.dev/core";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { Menu } from "~/components/menu";

export default component$(() => (
  <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-3 py-5 sm:px-6 sm:py-8 lg:py-12">
    <div class="mx-auto w-full max-w-4xl space-y-6 rounded-3xl border border-white/80 bg-white p-4 shadow-xl shadow-slate-300/50 sm:space-y-8 sm:p-8">
      <div class="border-b border-slate-100 pb-5 sm:pb-6">
        <Header />
        <Menu />
      </div>
      <main>
        <Slot />
      </main>
      <Footer />
    </div>
  </div>
));
