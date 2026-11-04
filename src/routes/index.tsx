import { component$ } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";

// "/" has no content of its own: it always lands on the Today Log.
export const onGet: RequestHandler = ({ redirect, basePathname }) => {
  throw redirect(302, `${basePathname}today/`);
};

export default component$(() => <></>);
