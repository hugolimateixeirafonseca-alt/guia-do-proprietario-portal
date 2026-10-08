import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentConfig = await readFile(new URL("../src/content.config.ts", import.meta.url), "utf8");
const home = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const newsIndex = await readFile(new URL("../src/pages/novidades/index.astro", import.meta.url), "utf8");
const newsSorting = await readFile(new URL("../src/lib/notas.ts", import.meta.url), "utf8");
const model = await readFile(new URL("../MODELO-NOVIDADE.mdx", import.meta.url), "utf8");

test("a coleção de novidades aceita Markdown e MDX", () => {
  assert.match(contentConfig, /base:\s*"\.\/src\/content\/notas"/);
  assert.match(contentConfig, /pattern:\s*"\*\*\/\*\.\{md,mdx\}"/);
});

test("as novidades são ordenadas da mais recente para a mais antiga", () => {
  assert.match(newsIndex, /sort\(compararNotasRecentes\)/);
  assert.match(newsSorting, /b\.data\.data\.valueOf\(\) - a\.data\.data\.valueOf\(\)/);
  assert.match(newsSorting, /b\.id\.localeCompare\(a\.id/);
});

test("cada notícia apresenta o botão Ver mais", () => {
  assert.match(newsIndex, /class="news-more"[^>]*>Ver mais<\/a>/);
});

test("a página inicial deixa de apresentar a secção e o atalho de novidades", () => {
  assert.doesNotMatch(home, /getCollection\("notas"\)|notas\.slice|id="novidades"|href="#novidades"|href="\/novidades\/"/);
  assert.match(home, /id="mais-recentes"/);
  assert.match(home, /id="perguntas-dia"/);
});

test("o modelo contém os campos obrigatórios da novidade", () => {
  for (const field of ["titulo", "resumo", "data", "fonte_nome", "fonte_url"]) {
    assert.match(model, new RegExp(`^${field}:`, "m"));
  }
});
