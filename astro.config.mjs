import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://guiadoproprietario.pt",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx(), sitemap()],
  markdown: { shikiConfig: { theme: "github-light" } }
});
