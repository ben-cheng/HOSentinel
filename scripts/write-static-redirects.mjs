// The static build has no page for "/", so GitHub Pages would 404 there.
// Write a tiny redirect page to index.html (and reuse it as 404.html).
import { writeFileSync } from "node:fs";

const target = "today/";
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>HOSentinel</title>
    <meta http-equiv="refresh" content="0; url=${target}" />
    <script>location.replace(new URL("${target}", location.href.replace(/[^/]*$/, "")).href);</script>
  </head>
  <body><a href="${target}">Open HOSentinel</a></body>
</html>
`;

writeFileSync("dist/index.html", html);
