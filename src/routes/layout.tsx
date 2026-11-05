import { component$, Slot } from "@qwik.dev/core";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";
import { Menu } from "~/components/menu";

// Named slots only project from a component's direct children, so the layout
// fills them on AppFrame; the routed page arrives through the default slot.
export default component$(() => (

  <div class="min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-blue-100 px-4 py-8 sm:px-6 lg:py-12">
    <div class="mx-auto w-full max-w-4xl space-y-8 rounded-3xl border border-white/80 bg-white p-5 shadow-xl shadow-slate-300/50 sm:p-8">
      <div class="border-b border-slate-100 pb-6">
        <Header />
        <Menu />
      </div>
      <Slot />
      <Footer />
    </div>
  </div>
  
));
