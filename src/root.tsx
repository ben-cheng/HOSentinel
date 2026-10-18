import {
  $,
  component$,
  isDev,
  useContextProvider,
  useOnWindow,
  useSignal,
} from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head/router-head";
import { HosContext } from "./components/hos-log/hours-of-service";
import type { DailyLog } from "./components/hos-log/hours-of-service";

import "./global.css";

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default component$(() => {
  const dailyLog = useSignal<DailyLog>({
    date: getLocalDateKey(new Date()),
    entries: [],
    completedAt: null,
  });
  useContextProvider(HosContext, dailyLog);

  useOnWindow(
    "load",
    $(() => {
      if (!isDev && "serviceWorker" in navigator) {
        navigator.serviceWorker
          .register(`${import.meta.env.BASE_URL}sw.js`, {
            scope: import.meta.env.BASE_URL,
          })
          .catch((error: unknown) => {
            console.error(
              "Failed to register HOSentinel's service worker:",
              error,
            );
          });
      }
    }),
  );

  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <meta name="theme-color" content="#111827" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link
          rel="apple-touch-icon"
          href={`${import.meta.env.BASE_URL}app-icon-192.png`}
        />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
      </head>
      <body lang="en">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
