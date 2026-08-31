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
  visualReadings: [{
    category: "ponto_a_confirmar",
    title: "Zona junto à janela",
    observation: "A parede aparece apenas parcialmente na captura.",
    recommendedConfirmation: "Peça para mostrarem a parede durante uma videochamada em direto.",
    sourceImages: [1]
  }]
};

test("o relatório web mantém 12 verificações, leitura visual e conteúdo escapado", () => {
  const html = renderReportHtml({
    report,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z",
    capturePreviews: [{ url: "/verificacao/evidence/token/1", label: "Captura 1" }]
  });
  assert.equal((html.match(/<details class="check-row /gu) || []).length, 12);
  assert.match(html, /Zona junto à janela/u);
  assert.match(html, /Captura 1/u);
  assert.match(html, /\/verificacao\/evidence\/token\/1/u);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.match(html, /&lt;script&gt;alert/u);
  assert.match(html, /A decisão antes de pagar/u);
  assert.match(html, /Não pague ainda/u);
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

test("a leitura visual transforma as fotografias em observações e confirmações úteis", () => {
  const visualReport = {
    ...report,
    visualReadings: [
      {
        category: "coerencia",
        title: "Acabamentos coerentes",
        observation: "O pavimento e os rodapés repetem-se nas duas capturas.",
        recommendedConfirmation: "Peça uma passagem contínua entre as divisões.",
        sourceImages: [1, 2]
      },
      {
        category: "ponto_a_confirmar",
        title: "Parede junto à janela",
        observation: "A zona aparece parcialmente tapada.",
        recommendedConfirmation: "Peça para mostrarem toda a parede em direto.",
        sourceImages: [3]
      }
    ]
  };
  const html = renderReportHtml({
    report: visualReport,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /O que as fotografias revelam/u);
  assert.match(html, /Há um detalhe nas fotografias que vale a pena confirmar em direto/u);
  assert.match(html, /Acabamentos coerentes/u);
  assert.match(html, /Parede junto à janela/u);
  assert.match(html, /Peça para mostrarem toda a parede em direto/u);
  assert.doesNotMatch(html, /correspondências|noutros anúncios|Fonte ↗|YouTube/iu);
});

test("um detalhe visual concreto recebe destaque sem se transformar num diagnóstico", () => {
  const html = renderReportHtml({
    report,
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /Detalhes visuais para confirmar/u);
  assert.match(html, /Uma lista concreta do que deve pedir ao anunciante/u);
  assert.match(html, /não é um diagnóstico do imóvel/iu);
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
    report: { ...report, checks, visualReadings: [] },
    createdAt: "2026-08-29T12:00:00.000Z",
    expiresAt: "2026-11-27T12:00:00.000Z"
  });
  assert.match(html, /O anúncio pede pagamento antes da visita ou do contrato/u);
  assert.match(html, /Não transfira dinheiro/u);
  assert.doesNotMatch(html, /V1|Esta versão|versão interna/u);
});
