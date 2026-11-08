import { component$, useVisibleTask$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";

export default component$(() => {
  const nav = useNavigate();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    nav("/today");
  });

  return (
    <div />
  );
});
