import assert from "node:assert/strict";
import test from "node:test";
import { valorFrontmatter } from "../scripts/lib/frontmatter.mjs";

test("lê um título de uma linha", () => {
  assert.equal(valorFrontmatter('---\ntitulo: "Título simples"\n---\n', "titulo"), "Título simples");
});

test("lê um título YAML repartido por linhas", () => {
  const source = '---\ntitulo: "Manutenção da casa: o que verificar todos os meses, todos os anos e\n  antes do inverno"\n---\n';
  assert.equal(valorFrontmatter(source, "titulo"), "Manutenção da casa: o que verificar todos os meses, todos os anos e antes do inverno");
});

test("rejeita títulos sem fecho de aspas", () => {
  assert.equal(valorFrontmatter('---\ntitulo: "Título incompleto\n---\n', "titulo"), null);
});
