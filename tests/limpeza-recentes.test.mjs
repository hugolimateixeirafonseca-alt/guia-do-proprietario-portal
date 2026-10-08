import assert from "node:assert/strict";
import test from "node:test";
import { organizarArtigosRecentes, compararPorPublicacao } from "../src/lib/artigos.ts";

const artigo = (id, dia, limpeza = false) => ({ id, data: { titulo: id, publicado_em: new Date(dia), chegada: new Date(dia), temas: limpeza ? ["limpeza-servicos"] : [] } });

test("recentes intercalam limpeza sem perder artigos nem alterar datas ou a entrada", () => {
  const entrada = [artigo("L1", "2026-10-08", true), artigo("L2", "2026-10-08", true), artigo("L3", "2026-10-08", true), ...[7, 6, 5, 4].map(dia => artigo("N" + dia, "2026-10-0" + dia))];
  const antes = structuredClone(entrada);
  const resultado = organizarArtigosRecentes(entrada);
  assert.deepEqual(resultado.map(a => a.id), ["L1", "N7", "N6", "L2", "N5", "N4", "L3"]);
  assert.deepEqual(entrada, antes);
  assert.equal(new Set(resultado.map(a => a.id)).size, entrada.length);
  assert.deepEqual([...entrada].sort(compararPorPublicacao).slice(0, 3).map(a => a.id), ["L1", "L2", "L3"]);
});
test("sem limpeza preserva a ordenação cronológica e os desempates", () => {
  const entrada = [artigo("B", "2026-10-06"), artigo("A", "2026-10-08"), artigo("C", "2026-10-08")];
  assert.deepEqual(organizarArtigosRecentes(entrada), [...entrada].sort(compararPorPublicacao));
});
test("listas vazias, de um só tema e com poucos separadores mantêm todas as entradas", () => {
  assert.deepEqual(organizarArtigosRecentes([]), []);
  const limpeza = [artigo("L1", "2026-10-08", true), artigo("L2", "2026-10-07", true)];
  assert.deepEqual(organizarArtigosRecentes(limpeza), limpeza);
  assert.deepEqual(organizarArtigosRecentes([...limpeza, artigo("N1", "2026-10-06")]).map(a => a.id), ["L1", "N1", "L2"]);
});
