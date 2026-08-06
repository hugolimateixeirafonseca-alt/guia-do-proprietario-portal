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
  assert.match(home, /sort\(compararNotasRecentes\)/);
  assert.match(newsIndex, /sort\(compararNotasRecentes\)/);
  assert.match(newsSorting, /b\.data\.data\.valueOf\(\) - a\.data\.data\.valueOf\(\)/);
  assert.match(newsSorting, /a\.id\.localeCompare\(b\.id/);
});

test("cada notícia apresenta o botão Ver mais", () => {
  assert.match(home, /class="news-more"[^>]*>Ver mais<\/a>/);
  assert.match(newsIndex, /class="news-more"[^>]*>Ver mais<\/a>/);
});

test("a página inicial mantém a lista automática sem o quadro de última novidade", () => {
  assert.match(home, /getCollection\("notas"\)/);
  assert.match(home, /notas\.slice\(0, 3\)/);
  assert.doesNotMatch(home, /Última novidade|notaRecente|latest-note/);
  assert.ok(home.indexOf('id="novidades"') > home.indexOf('aria-labelledby="mais-recentes-titulo"'));
  assert.ok(home.indexOf('id="novidades"') < home.indexOf('id="perguntas-dia"'));
});

test("o modelo contém os campos obrigatórios da novidade", () => {
  for (const field of ["titulo", "resumo", "data", "fonte_nome", "fonte_url"]) {
    assert.match(model, new RegExp(`^${field}:`, "m"));
  }
});
