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
  assert.match(html, /A decisão antes de pagar/u);
  assert.match(html, /Não transfira dinheiro/u);
  assert.match(html, /Sinais relevantes antes de pagar/u);
  assert.match(html, /Mensagem pronta/u);
  assert.match(html, /Evidência detalhada/u);
  assert.doesNotMatch(html, /Cobertura observável|A V1|Esta versão/u);
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
  assert.match(html, /sistema inteligente com IA/iu);
  assert.match(html, /poucos minutos/u);
});

test("a pesquisa visual transforma os resultados num destaque claro e útil", () => {
  const photoReport = {
    ...report,
    reverseImageEvidence: [
      ...Array.from({ length: 3 }, (_, index) => ({
        photo_id: `foto-${index + 1}`,
        state: "sem_correspondencia_encontrada",
        source_url: null,
        source_domain: null
      })),
      {
        photo_id: "foto-4",
        state: "pesquisa_indisponivel",
        source_url: null,
        source_domain: null
      }
    ]
  };
  const html = renderReportHtml({
    report: photoReport,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /Pesquisa visual das fotografias/u);
  assert.match(html, /3 das 4 fotografias não aparecem noutros anúncios públicos/u);
  assert.match(html, /É um sinal positivo porque reduz um padrão comum em anúncios fraudulentos/u);
  assert.match(html, /1<\/b> fotografia sem resultado fiável/u);
  assert.doesNotMatch(html, /correspondências públicas relevantes|pesquisa ficou inconclusiva/u);
  assert.match(html, /<li class="photo-row talk/u);
});

test("uma fotografia encontrada noutro contexto recebe um alerta visual forte", () => {
  const html = renderReportHtml({
    report,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /Sinal de atenção nas fotografias/u);
  assert.match(html, /Encontrámos 1 fotografia associada a outro anúncio ou contexto público/u);
  assert.match(html, /Se a explicação não for clara, não pague/u);
  assert.match(html, /photo-feature attention/u);
});

test("pagamento antes da visita domina o veredicto e linguagem interna antiga é ocultada", () => {
  const checks = report.checks.map((check) => ({ ...check }));
  checks[5] = {
    ...checks[5],
    state: "sinal_atencao",
    observation: "O anúncio pede a caução antes da visita.",
    action: "Não transferir antes de visitar ou fazer uma videochamada em direto."
  };
  checks[10] = {
    ...checks[10],
    observation: "Esta verificação não é confirmável na V1."
  };
  const html = renderReportHtml({
    report: { ...report, checks, reverseImageEvidence: [] },
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /O anúncio pede pagamento antes da visita ou do contrato/u);
  assert.match(html, /Não transfira dinheiro/u);
  assert.doesNotMatch(html, /V1|Esta versão|versão interna/u);
});
