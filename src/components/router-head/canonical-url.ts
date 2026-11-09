export function canonicalUrl(url: URL, baseUrl: string): string {
  const canonical = new URL(url.href);
  if (baseUrl !== "/") {
    const path = canonical.pathname;
    canonical.pathname = path.toLowerCase().startsWith(baseUrl.toLowerCase())
      ? `${baseUrl}${path.slice(baseUrl.length)}`
      : `${baseUrl}${path.replace(/^\/+/, "")}`;
  }
  return canonical.href;
}
