import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://guiadoproprietario.pt",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx(), sitemap({
    filter: (page) => page !== "https://guiadoproprietario.pt/quanto-me-sobra-se-vender/"
  })],
  markdown: { shikiConfig: { theme: "github-light" } }
});
