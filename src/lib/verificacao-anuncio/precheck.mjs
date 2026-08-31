const LABELS = Object.freeze({
  cidade: "localização",
  zona: "zona",
  morada: "morada",
  preco_mensal: "preço mensal",
  tipologia: "tipologia",
  area: "área",
  despesas: "despesas",
  caucao: "caução",
  sinal: "sinal",
  primeira_renda: "primeira renda",
  outros_pagamentos: "outros pagamentos",
  momento_pagamento: "momento do pagamento",
  visita_presencial: "visita presencial",
  contrato_escrito: "contrato escrito"
});

export function buildPrecheckTeaser(extraction, captureCount) {
  const facts = Array.isArray(extraction?.factos) ? extraction.factos : [];
  const present = facts.filter((fact) => fact?.presente === true && LABELS[fact.campo]);
  const fields = [...new Set(present.map((fact) => LABELS[fact.campo]))].slice(0, 5);
  const photoCount = Math.min(6, Array.isArray(extraction?.regioes_fotografias) ? extraction.regioes_fotografias.length : 0);
  const paymentFields = new Set(["caucao", "sinal", "primeira_renda", "outros_pagamentos", "momento_pagamento"]);
  const hasPaymentConditions = present.some((fact) => paymentFields.has(fact.campo));
  const useful = present.length >= 2 || photoCount > 0;

  return {
    useful,
    captureCount,
    factCount: present.length,
    photoCount,
    fields,
    headline: useful
      ? "As capturas têm informação suficiente para uma análise útil."
      : "Precisamos de mais informação visível para produzir uma análise útil.",
    signal: hasPaymentConditions
      ? "Detetámos condições de pagamento que merecem ser cruzadas antes de qualquer transferência."
      : "A análise completa vai cruzar as condições, o contexto e as fotografias antes de qualquer transferência."
  };
}
