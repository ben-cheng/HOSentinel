import { expect, test } from "vitest";
import { canonicalUrl } from "./canonical-url";

test.each([
  ["/hosentinel/today/", "/HOSentinel/", "/HOSentinel/today/"],
  ["/HOSentinel/history/", "/HOSentinel/", "/HOSentinel/history/"],
  ["/report/", "/HOSentinel/", "/HOSentinel/report/"],
  ["/today/", "/", "/today/"],
])("canonicalizes %s with base %s", (path, base, expected) => {
  const url = new URL(path, "https://example.com");
  expect(canonicalUrl(url, base)).toBe(`https://example.com${expected}`);
  expect(url.pathname).toBe(path);
});
