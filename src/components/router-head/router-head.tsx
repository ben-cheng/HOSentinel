import { component$ } from "@qwik.dev/core";
import { useDocumentHead, useLocation } from "@qwik.dev/router";

/**
 * The RouterHead component is placed inside of the document `<head>` element.
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();
  const canonicalUrl = new URL(loc.url.href);
  const baseUrl = import.meta.env.BASE_URL;

  if (baseUrl !== "/" && !canonicalUrl.pathname.startsWith(baseUrl)) {
    canonicalUrl.pathname = `${baseUrl}${canonicalUrl.pathname.replace(/^\/+/, "")}`;
  }

  return (
    <>
      <title>{head.title}</title>

      <link rel="canonical" href={canonicalUrl.href} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link
        rel="icon"
        type="image/svg+xml"
        href={`${import.meta.env.BASE_URL}favicon.svg`}
      />

      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}

      {head.links.map((l) => (
        <link key={l.key} {...l} />
      ))}

      {head.styles.map((s) => (
        <style
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.style })}
        />
      ))}

      {head.scripts.map((s) => (
        <script
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.script })}
        />
      ))}
    </>
  );
});
