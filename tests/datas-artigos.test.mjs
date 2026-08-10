import assert from "node:assert/strict";
import test from "node:test";
import { lerDatasFrontmatter, preencherDatasFrontmatter } from "../scripts/lib/datas-artigos.mjs";

test("preenche as datas imediatamente depois de publicado", () => {
  const source = "---\ntitulo: Exemplo\npublicado: 2026-08-10\nrevisto: 2026-08-10\n---\n\nTexto.";
  const result = preencherDatasFrontmatter(source, {
    chegada: "2026-08-06T13:55:13+01:00",
    publicadoEm: "2026-08-10T07:00:27Z",
  });

  assert.match(result, /publicado: 2026-08-10\nchegada: 2026-08-06T13:55:13\+01:00\npublicado_em: 2026-08-10T07:00:27Z\nrevisto:/);
});

test("ignora texto fora do frontmatter e preenche campos vazios sem duplicar chaves", () => {
  const source = "---\npublicado: 2026-08-10\nchegada:\npublicado_em:\n---\n\nchegada: não é metadado";
  const result = preencherDatasFrontmatter(source, {
    chegada: "2026-08-06T13:55:13Z",
    publicadoEm: "2026-08-10T07:00:27Z",
  });

  assert.deepEqual(lerDatasFrontmatter(result), {
    chegada: "2026-08-06T13:55:13Z",
    publicadoEm: "2026-08-10T07:00:27Z",
  });
  assert.equal(result.match(/^chegada:/gm)?.length, 2);
  assert.equal(result.match(/^publicado_em:/gm)?.length, 1);
});
