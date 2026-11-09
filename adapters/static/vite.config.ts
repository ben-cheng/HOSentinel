import { viteAdapter } from "@qwik.dev/router/adapters/shared/vite";
import { extendConfig } from "@qwik.dev/router/vite";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import baseConfig, { deploymentBase } from "../../vite.config.ts";

const origin = "https://ben-cheng.github.io";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ["@qwik-router-config"],
      },
    },
    plugins: [
      viteAdapter({
        name: "static-site-generation",
        origin,
        ssg: { include: ["/*"], origin },
        async generate({ clientPublicOutDir, basePathname }) {
          // SSG uses the normalized router base in its sitemap URLs.
          const sitemapPath = join(clientPublicOutDir, "sitemap.xml");
          const sitemap = await readFile(sitemapPath, "utf8");
          const routerPrefix = new URL(basePathname, origin).href;
          const deploymentPrefix = new URL(deploymentBase, origin).href;
          await writeFile(sitemapPath, sitemap.replaceAll(routerPrefix, deploymentPrefix));
        },
      }),
    ],
  };
});
