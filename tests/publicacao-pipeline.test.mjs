import assert from "node:assert/strict";
import test from "node:test";
import { datasEditoriais } from "../src/lib/datas-editoriais.mjs";
import { selecionarArtigo } from "../scripts/selecionar-artigo-publicacao.mjs";

test("rascunho de agosto publicado em setembro apresenta a publicação de setembro", () => {
  const datas = datasEditoriais({ publicado_em: "2026-09-09T07:01:37Z", revisto: "2026-08-12" });
  assert.equal(datas.publicacao.toISOString(), "2026-09-09T07:01:37.000Z");
  assert.equal(datas.atualizacao.toISOString(), datas.publicacao.toISOString());
  assert.equal(datas.revisaoPosterior, false);
});

test("revisão posterior à publicação continua visível", () => {
  const datas = datasEditoriais({ publicado_em: "2026-08-12T07:00:00Z", revisto: "2026-09-09" });
  assert.equal(datas.revisaoPosterior, true);
  assert.equal(datas.atualizacao.toISOString(), "2026-09-09T00:00:00.000Z");
});

test("datas do mesmo dia em Lisboa não criam uma atualização artificial", () => {
  assert.equal(datasEditoriais({ publicado_em: "2026-09-08T23:30:00Z", revisto: "2026-09-09" }).revisaoPosterior, false);
});

test("fila mantém prioridade e ignora entradas já publicadas", () => {
  assert.equal(selecionarArtigo({ fila: "# Fila\r\nantigo.mdx\r\nsegundo.mdx\r\nprimeiro.mdx\r\n", pendentes: ["primeiro.mdx", "segundo.mdx"], publicados: ["antigo.mdx"] }), "segundo.mdx");
});

test("fila desatualizada não escolhe silenciosamente outro artigo", () => {
  assert.throws(() => selecionarArtigo({ fila: "antigo.mdx", pendentes: ["novo.mdx"], publicados: ["antigo.mdx"] }), /FILA_DESATUALIZADA/);
  assert.throws(() => selecionarArtigo({ fila: "inexistente.mdx", pendentes: ["novo.mdx"], publicados: [] }), /não encontrado/);
});

test("artigos publicados nunca são sobrescritos", () => {
  assert.throws(() => selecionarArtigo({ fila: "antigo.mdx", pendentes: ["antigo.mdx"], publicados: ["antigo.mdx"] }), /já publicado/);
  assert.throws(() => selecionarArtigo({ fila: "../artigos/antigo.mdx", pendentes: [], publicados: [] }), /inválida/);
  assert.equal(selecionarArtigo({ fila: "antigo.mdx", pendentes: [], publicados: ["antigo.mdx"] }), "");
});
