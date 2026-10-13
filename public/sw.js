const CACHE_NAME = "hosentinel-v3";
const APP_SHELL_URL = new URL("./", self.registration.scope).href;
const PRECACHE_URLS = [
  APP_SHELL_URL,
  new URL("manifest.json", APP_SHELL_URL).href,
  new URL("app-icon.svg", APP_SHELL_URL).href,
  new URL("app-icon-192.png", APP_SHELL_URL).href,
  new URL("app-icon-512.png", APP_SHELL_URL).href,
  new URL("q-manifest.json", APP_SHELL_URL).href,
  new URL("q-data.json", APP_SHELL_URL).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheAppShell(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("hosentinel-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);

  if (
    request.method !== "GET" ||
    requestUrl.origin !== scopeUrl.origin ||
    !requestUrl.pathname.startsWith(scopeUrl.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);

  const clientManifest = await (await cache.match(
    new URL("q-manifest.json", APP_SHELL_URL),
  )).json();
  const appAssets = new Set([
    `build/${clientManifest.core}`,
    `build/${clientManifest.preloader}`,
    ...Object.keys(clientManifest.bundles).map((bundle) => `build/${bundle}`),
    ...Object.keys(clientManifest.assets),
  ]);

  await cache.addAll(
    [...appAssets].map((asset) => new URL(asset, APP_SHELL_URL).href),
  );
}

async function handleNavigation(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const cachedPage =
      (await caches.match(request)) ?? (await caches.match(APP_SHELL_URL));
    if (cachedPage) return cachedPage;
    throw error;
  }

  if (response.ok) {
    try {
      await (await caches.open(CACHE_NAME)).put(request, response.clone());
    } catch (error) {
      console.error("Failed to cache the HOSentinel page:", error);
    }
  }
  return response;
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    try {
      await (await caches.open(CACHE_NAME)).put(request, response.clone());
    } catch (error) {
      console.error("Failed to cache a HOSentinel resource:", error);
    }
  }
  return response;
}
