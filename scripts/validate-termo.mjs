import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const raiz = process.cwd();
const componente = await readFile(resolve(raiz, "src/components/Termo.astro"), "utf8");
const estilos = await readFile(resolve(raiz, "src/styles/global.css"), "utf8");

if (/<(?:details|div|p|section|aside)\b[^>]*class=["'][^"']*\btermo\b/i.test(componente)) {
  throw new Error("O componente Termo usa um elemento de bloco e pode voltar a partir parágrafos.");
}

if (!/<span\b[^>]*class=["'][^"']*\btermo\b/i.test(componente)) {
  throw new Error("O componente Termo tem de usar um contentor inline.");
}

if (!/\.termo\s*\{[^}]*display:\s*inline\s*;/s.test(estilos)) {
  throw new Error("A classe .termo tem de declarar display: inline.");
}

const casos = [
  {
    ficheiro: "dist/vender/documentos-para-vender-casa/index.html",
    termo: "caderneta predial",
    antes: "Localize a",
    depois: "certidão do registo predial"
  },
  {
    ficheiro: "dist/impostos/imi-explicado-simples/index.html",
    termo: "VPT",
    antes: "A primeira é o",
    depois: "A segunda é a taxa"
  },
  {
    ficheiro: "dist/vender/o-que-fazer-casa-herdada/index.html",
    termo: "mais-valia",
    antes: "Se pensarem vender",
    depois: "antes de dividir"
  }
];

for (const caso of casos) {
  const html = await readFile(resolve(raiz, caso.ficheiro), "utf8");
  const paragrafos = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((resultado) => resultado[0]);
  const continuo = paragrafos.some((paragrafo) =>
    paragrafo.includes('class="termo"') &&
    paragrafo.includes(caso.termo) &&
    paragrafo.includes(caso.antes) &&
    paragrafo.includes(caso.depois)
  );

  if (!continuo) {
    throw new Error(`O termo "${caso.termo}" não ficou dentro de um único parágrafo em ${caso.ficheiro}.`);
  }
}

console.log("Termo inline validado em três artigos: caderneta predial, VPT e mais-valia.");
