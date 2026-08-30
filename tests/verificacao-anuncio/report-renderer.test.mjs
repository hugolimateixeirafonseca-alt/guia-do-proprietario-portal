import assert from "node:assert/strict";
import test from "node:test";
import { renderReportHtml } from "../../src/lib/verificacao-anuncio/report-renderer.mjs";

const report = {
  confirmedCount: 4,
  checks: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Verificação ${index + 1}`,
    state: index < 4 ? "confirmado" : (index === 11 ? "nao_verificavel" : "por_confirmar"),
    observation: index === 0 ? "Texto <script>alert(1)</script>" : "Informação observável.",
    action: index < 4 || index === 11 ? null : "Confirmar antes de pagar."
  })),
  nextActions: [{ text: "Pedir uma videochamada." }],
  reverseImageEvidence: [{
    source_url: "https://example.com/anuncio",
    source_domain: "example.com",
    state: "correspondencia_contexto_diferente",
    context_excerpt: "O anúncio refere outra cidade."
  }]
};

test("o relatório web mantém 12 verificações, fonte e conteúdo escapado", () => {
  const html = renderReportHtml({
    report,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z",
    capturePreviews: [{ url: "/verificacao/evidence/token/1", label: "Captura 1" }]
  });
  assert.equal((html.match(/<details class="check-row /gu) || []).length, 12);
  assert.match(html, /https:\/\/example\.com\/anuncio/u);
  assert.match(html, /\/verificacao\/evidence\/token\/1/u);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.match(html, /&lt;script&gt;alert/u);
  assert.match(html, /Leitura executiva/u);
  assert.match(html, /Guião para a próxima chamada/u);
  assert.match(html, /As 12 verificações/u);
  assert.match(html, /Não penalizamos um anúncio por não explicar tudo/u);
  assert.match(html, /Confirme por escrito como será feita a comunicação do contrato às Finanças/u);
});

test("o relatório é uma entrega web sem ligação para PDF", () => {
  const html = renderReportHtml({
    report,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.doesNotMatch(html, /Descarregar PDF|\/verificacao\/pdf\//u);
  assert.match(html, /Relatório privado/u);
});
