import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentConfig = await readFile(new URL("../src/content.config.ts", import.meta.url), "utf8");
const home = await readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8");
const model = await readFile(new URL("../MODELO-NOVIDADE.mdx", import.meta.url), "utf8");

test("a coleção de novidades aceita Markdown e MDX", () => {
  assert.match(contentConfig, /base:\s*"\.\/src\/content\/notas"/);
  assert.match(contentConfig, /pattern:\s*"\*\*\/\*\.\{md,mdx\}"/);
});

test("a página inicial mantém a lista automática sem o quadro de última novidade", () => {
  assert.match(home, /getCollection\("notas"\)/);
  assert.match(home, /notas\.slice\(0, 3\)/);
  assert.doesNotMatch(home, /Última novidade|notaRecente|latest-note/);
});

test("o modelo contém os campos obrigatórios da novidade", () => {
  for (const field of ["titulo", "resumo", "data", "fonte_nome", "fonte_url"]) {
    assert.match(model, new RegExp(`^${field}:`, "m"));
  }
});
