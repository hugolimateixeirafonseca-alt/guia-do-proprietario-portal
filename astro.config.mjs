import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://guiadoproprietario.pt",
  output: "static",
  trailingSlash: "always",
  integrations: [mdx(), sitemap({
    filter: (page) => ![
      "https://guiadoproprietario.pt/quanto-me-sobra-se-vender/",
      "https://guiadoproprietario.pt/servicos-limpeza/",
      "https://guiadoproprietario.pt/seguro-vida-credito-habitacao/",
      "https://guiadoproprietario.pt/seguro-vida-simulacao/",
      "https://guiadoproprietario.pt/seguro-vida-diagnostico/",
      "https://guiadoproprietario.pt/janelas-diagnostico/",
      "https://guiadoproprietario.pt/campanha-janelas/",
      "https://guiadoproprietario.pt/kit-estudante/obrigado/"
    ].includes(page)
  })],
  markdown: { shikiConfig: { theme: "github-light" } }
});
