import { VERIFICATION_BY_ID } from "./verification-config.mjs";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/gu, "&amp;")
  .replace(/</gu, "&lt;")
  .replace(/>/gu, "&gt;")
  .replace(/"/gu, "&quot;")
  .replace(/'/gu, "&#39;");

const datePt = (value) => {
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(new Date(value));
  } catch {
    return "";
  }
};

const numberPt = (value) => new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value));

const readingFor = (check) => {
  if (check.reading) return check.reading;
  if (check.state === "confirmado") return "informacao_encontrada";
  if (/contradi|diferença|outro contexto|antes da visita|recusa/iu.test(check.observation || "")) return "sinal_atencao";
  return "confirmar_na_conversa";
};

const readingMeta = (reading) => ({
  informacao_encontrada: { label: "Encontrado", icon: "✓", tone: "found" },
  confirmar_na_conversa: { label: "Confirmar diretamente", icon: "●", tone: "talk" },
  sinal_atencao: { label: "Merece atenção", icon: "!", tone: "attention" }
}[reading] || { label: "Confirmar diretamente", icon: "●", tone: "talk" });

const actionFor = (check) => check.action || VERIFICATION_BY_ID.get(Number(check.id))?.action || "Confirme este ponto na conversa antes de avançar.";
const questionFor = (check) => VERIFICATION_BY_ID.get(Number(check.id))?.question || actionFor(check);

const customerObservationFor = (check) => {
  const observation = String(check?.observation ?? "").trim();
  if (!observation) return "Este ponto exige confirmação adicional.";
  if (/\bvers[aã]o\b|\bn[aã]o suporta\b|\bV\s*\d/iu.test(observation)) {
    if (Number(check.id) === 11) {
      return "As capturas não permitem confirmar quem é o proprietário ou está autorizado a arrendar o imóvel.";
    }
    return "Este ponto exige confirmação adicional fora do anúncio.";
  }
  return observation;
};

const buildContactMessage = (questions) => {
  if (!questions.length) {
    return "Olá. Gostaria de marcar uma visita presencial ao imóvel e receber a minuta do contrato com todos os valores discriminados antes de qualquer pagamento. Obrigado.";
  }
  const lines = questions.map((check, index) => String(index + 1) + ". " + questionFor(check));
  return [
    "Olá. Antes de avançar, preciso de confirmar estes pontos sobre o imóvel:",
    "",
    ...lines,
    "",
    "Assim que tiver estes elementos e puder visitar o imóvel, avalio os próximos passos. Obrigado."
  ].join("\n");
};

const verdictFor = ({ attention, talk, differentContext }) => {
  const payment = attention.find((check) => Number(check.id) === 6);
  const visit = attention.find((check) => Number(check.id) === 7);
  if (payment && /antes da visita|antes do contrato|pagamento antecipado|pagar antes/iu.test(customerObservationFor(payment))) {
    return {
      tone: "danger",
      label: "Não transfira dinheiro",
      title: "O anúncio pede pagamento antes da visita ou do contrato.",
      text: "É um sinal objetivo que deve ser esclarecido. Visite o imóvel, confirme quem pode arrendá-lo e peça a minuta antes de pagar."
    };
  }
  if (visit) {
    return {
      tone: "danger",
      label: "Pare antes de pagar",
      title: "A visita presencial não está a ser aceite.",
      text: "Não transfira qualquer valor enquanto não conseguir visitar o imóvel ou validar a situação por uma videochamada em direto."
    };
  }
  if (differentContext.length) {
    return {
      tone: "danger",
      label: "Não transfira dinheiro",
      title: "Encontrámos uma fotografia associada a outro contexto público.",
      text: "Peça uma explicação verificável e confirme o imóvel presencialmente antes de entregar qualquer valor."
    };
  }
  if (attention.length) {
    return {
      tone: "danger",
      label: "Não pague ainda",
      title: attention.length === 1 ? "Existe um sinal concreto que precisa de esclarecimento." : "Existem sinais concretos que precisam de esclarecimento.",
      text: "Resolva os pontos destacados e obtenha respostas por escrito antes de transferir dinheiro."
    };
  }
  if (talk.length) {
    return {
      tone: "caution",
      label: "Não pague ainda",
      title: "Pode continuar a conversa, mas ainda faltam confirmações importantes.",
      text: "Use a mensagem preparada abaixo, marque a visita e peça a minuta do contrato antes de qualquer transferência."
    };
  }
  return {
    tone: "positive",
    label: "Próximo passo: visitar",
    title: "Pode avançar para a visita, sem transferir dinheiro nesta fase.",
    text: "Confirme presencialmente o imóvel, a identidade de quem arrenda e a minuta do contrato antes de pagar."
  };
};

const priorityOrder = [6, 7, 8, 10, 11, 5, 12, 9, 4, 2, 3, 1];

const photoResultMeta = (state) => ({
  correspondencia_mesmo_contexto: { label: "Correspondência no mesmo contexto", tone: "found" },
  correspondencia_contexto_diferente: { label: "Encontrada noutro contexto", tone: "attention" },
  correspondencia_inconclusiva: { label: "Resultado inconclusivo", tone: "talk" },
  sem_correspondencia_encontrada: { label: "Sem correspondência pública relevante", tone: "found" },
  pesquisa_indisponivel: { label: "Pesquisa sem resultado conclusivo", tone: "talk" }
}[state] || { label: "Pesquisa concluída", tone: "talk" });

const factLabels = {
  cidade: "Cidade", zona: "Zona", morada: "Localização", preco_mensal: "Preço mensal",
  tipologia: "Tipologia", area: "Área", despesas: "Despesas", caucao: "Caução",
  sinal: "Sinal", primeira_renda: "Primeira renda", outros_pagamentos: "Outros pagamentos",
  momento_pagamento: "Momento do pagamento", visita_presencial: "Visita", contrato_escrito: "Contrato",
  recibos: "Recibos", comunicacao_financas: "Finanças"
};

/**
 * @param {{ report: any, createdAt: string, expiresAt: string, capturePreviews?: Array<{ url: string, label: string }> }} options
 */
export function renderReportHtml({ report, createdAt, expiresAt, capturePreviews = [] }) {
  const checks = (report?.checks ?? []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  const readings = checks.map((check) => ({
    ...check,
    reading: readingFor(check),
    observation: customerObservationFor(check)
  }));
  const found = readings.filter((check) => check.reading === "informacao_encontrada");
  const talk = readings.filter((check) => check.reading === "confirmar_na_conversa");
  const attention = readings.filter((check) => check.reading === "sinal_atencao");
  const reverseEvidence = report?.reverseImageEvidence ?? [];
  const photoCount = new Set(reverseEvidence.map((item) => item.photo_id || item.image_id || item.id).filter(Boolean)).size || reverseEvidence.length;
  const noMatches = reverseEvidence.filter((item) => item.state === "sem_correspondencia_encontrada");
  const sameContext = reverseEvidence.filter((item) => item.state === "correspondencia_mesmo_contexto");
  const differentContext = reverseEvidence.filter((item) => item.state === "correspondencia_contexto_diferente");
  const inconclusive = reverseEvidence.filter((item) => item.state === "correspondencia_inconclusiva");
  const unavailable = reverseEvidence.filter((item) => item.state === "pesquisa_indisponivel");
  const signalCount = attention.length + (differentContext.length && !attention.some((check) => Number(check.id) === 4) ? differentContext.length : 0);
  const observedFacts = (report?.observedFacts ?? []).filter((item) => factLabels[item.field]).slice(0, 8);

  const questions = readings
    .filter((check) => check.reading !== "informacao_encontrada")
    .sort((a, b) => priorityOrder.indexOf(Number(a.id)) - priorityOrder.indexOf(Number(b.id)))
    .slice(0, 5);
  const contactMessage = buildContactMessage(questions);
  const verdict = verdictFor({ attention, talk, differentContext });
  const riskChecks = attention.slice().sort((a, b) => priorityOrder.indexOf(Number(a.id)) - priorityOrder.indexOf(Number(b.id))).slice(0, 4);
  const contractIds = new Set([5, 6, 8, 9, 10, 11, 12]);
  const contractChecks = readings.filter((check) => contractIds.has(Number(check.id)) && check.reading !== "informacao_encontrada").slice(0, 5);
  const photoSummaryTitle = differentContext.length
    ? (differentContext.length === 1 ? "Encontrámos 1 fotografia noutro contexto público." : "Encontrámos " + differentContext.length + " fotografias noutros contextos públicos.")
    : noMatches.length
      ? (noMatches.length === 1 ? "1 fotografia pesquisada sem correspondência pública relevante." : noMatches.length + " fotografias pesquisadas sem correspondências públicas relevantes.")
      : sameContext.length
        ? (sameContext.length === 1 ? "Encontrámos 1 correspondência no mesmo contexto." : "Encontrámos " + sameContext.length + " correspondências no mesmo contexto.")
        : "A pesquisa visual não produziu uma correspondência útil.";
  const photoSummaryText = unavailable.length || inconclusive.length
    ? (unavailable.length + inconclusive.length) + ((unavailable.length + inconclusive.length) === 1 ? " pesquisa ficou inconclusiva." : " pesquisas ficaram inconclusivas.")
    : "Não encontrar uma correspondência não prova que a fotografia seja original.";

  const riskCardParts = [];
  if (differentContext.length && !riskChecks.some((check) => Number(check.id) === 4)) {
    riskCardParts.push(`<article class="risk-item"><span>!</span><div><b>Fotografia associada a outro contexto público</b><p>${escapeHtml(photoSummaryTitle)}</p><small>Peça uma explicação verificável e confirme o imóvel presencialmente antes de pagar.</small></div></article>`);
  }
  riskCardParts.push(...riskChecks.map((check) => `<article class="risk-item"><span>!</span><div><b>${escapeHtml(check.name)}</b><p>${escapeHtml(check.observation)}</p><small>${escapeHtml(actionFor(check))}</small></div></article>`));
  const riskCards = riskCardParts.length
    ? riskCardParts.slice(0, 4).join("")
    : `<article class="risk-clear"><span>✓</span><div><b>Não detetámos sinais concretos nas evidências analisadas.</b><p>Isto não confirma a identidade do anunciante nem substitui a visita e a validação do contrato.</p></div></article>`;

  const contractRows = contractChecks.length
    ? contractChecks.map((check) => `<li><span>→</span><div><b>${escapeHtml(check.name)}</b><p>${escapeHtml(questionFor(check))}</p></div></li>`).join("")
    : `<li><span>✓</span><div><b>Condições principais encontradas</b><p>Confirme-as novamente na minuta antes de assinar ou pagar.</p></div></li>`;

  const checkRows = readings.map((check) => {
    const meta = readingMeta(check.reading);
    return `<details class="check-row ${meta.tone}">
      <summary><span class="check-number">${String(check.id).padStart(2, "0")}</span><span class="check-symbol">${meta.icon}</span><span class="check-title"><b>${escapeHtml(check.name)}</b><small>${escapeHtml(check.observation)}</small></span><span class="status">${escapeHtml(meta.label)}</span><span class="chevron">⌄</span></summary>
      <div class="check-detail">${check.reading === "informacao_encontrada" ? `<b>O que sustentou esta leitura</b><p>${escapeHtml(check.observation)}</p>` : `<b>Como fechar este ponto</b><p>${escapeHtml(actionFor(check))}</p>`}</div>
    </details>`;
  }).join("");

  const previews = capturePreviews.length ? capturePreviews.map((item, index) => `<figure class="capture"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" loading="lazy"><figcaption><span>${escapeHtml(item.label)}</span><b>Evidência ${String(index + 1).padStart(2, "0")}</b></figcaption></figure>`).join("") : `<div class="captures-expired"><span>48h</span><b>As capturas já foram eliminadas.</b><p>O relatório conserva apenas as conclusões. As imagens originais são apagadas automaticamente.</p></div>`;

  const facts = observedFacts.length ? `<div class="facts">${observedFacts.map((item) => `<div><span>${escapeHtml(factLabels[item.field])}</span><b>${escapeHtml(item.value)}</b></div>`).join("")}</div>` : "";

  const relevantPhotoEvidence = [...differentContext, ...sameContext, ...inconclusive].slice(0, 4);
  const photoRows = relevantPhotoEvidence.map((item, index) => {
    const meta = photoResultMeta(item.state);
    return `<li class="photo-row ${meta.tone}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(meta.label)}</b>${item.context_excerpt ? `<small>${escapeHtml(item.context_excerpt)}</small>` : ""}</div>${item.source_url ? `<a href="${escapeHtml(item.source_url)}" rel="nofollow noreferrer" target="_blank">Fonte ↗</a>` : ""}</li>`;
  }).join("");

  const sources = relevantPhotoEvidence.filter((item) => item.source_url).map((item) => `<a href="${escapeHtml(item.source_url)}" rel="nofollow noreferrer" target="_blank">${escapeHtml(item.source_domain || "Fonte pública")} ↗</a>`).join("");
  const roomListing = observedFacts.some((item) => item.field === "tipologia" && /quarto|room/iu.test(String(item.value)));
  const priceReference = report?.priceReference;
  const priceCard = priceReference && !roomListing && Number.isFinite(Number(priceReference.listing_euros_per_m2)) && Number.isFinite(Number(priceReference.euros_per_m2))
    ? `<section class="price-card"><div><span>Preço observado</span><strong>${escapeHtml(numberPt(priceReference.listing_euros_per_m2))} €/m²</strong></div><i>versus</i><div><span>Referência de ${escapeHtml(priceReference.city)}</span><strong>${escapeHtml(numberPt(priceReference.euros_per_m2))} €/m²</strong></div><p>Referência de preços pedidos. Não é uma avaliação do imóvel nem indica, por si só, risco.</p>${priceReference.source_url ? `<a href="${escapeHtml(priceReference.source_url)}" rel="nofollow noreferrer" target="_blank">Consultar fonte ↗</a>` : ""}</section>`
    : "";

  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light"><title>Relatório privado | Verificação de Anúncio</title><style>
  :root{--ink:#102f2a;--navy:#173e4b;--green:#3e875d;--green2:#eaf4ea;--blue:#eaf3f5;--cream:#f5f3ed;--paper:#fff;--amber:#d8811d;--amber2:#fff1dc;--grey:#687773;--line:#dde4df;--red:#bb563f;--red2:#fff0eb;--shadow:0 18px 55px rgba(16,47,42,.09)}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Aptos,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}.page{width:min(1240px,calc(100% - 36px));margin:auto}.topbar{background:#0c302a;color:#fff}.topbar .page{display:flex;min-height:68px;align-items:center;justify-content:space-between}.brand{display:flex;gap:11px;align-items:center;font-weight:850}.brand i{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#d9f76d;color:#173b32;font-size:12px;font-style:normal}.private{display:flex;gap:8px;align-items:center;color:#c9d8d3;font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.private:before{content:"";width:7px;height:7px;border-radius:50%;background:#d9f76d}
  .report-head{padding:48px 0 29px;background:linear-gradient(145deg,#fff,#f3f6f2)}.head-grid{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:end}.kicker{margin:0 0 11px;color:var(--green);font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.report-head h1{max-width:820px;margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(38px,5.4vw,65px);line-height:1;letter-spacing:-.045em}.report-head h1 span{display:block;margin-top:7px;color:var(--navy);font-size:.56em;line-height:1.15;letter-spacing:-.025em}.created{display:flex;gap:9px;align-items:center;margin-top:22px;color:var(--grey);font-size:11px}.created:before{content:"";width:15px;height:15px;border:2px solid #83918d;border-radius:4px}.head-note{max-width:290px;padding:18px 20px;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--grey);font-size:12px;line-height:1.55}.head-note b{display:block;margin-bottom:4px;color:var(--ink);font-size:13px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;padding:22px 0}.metric{display:grid;grid-template-columns:44px 1fr;gap:12px;min-height:116px;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:0 8px 28px rgba(16,47,42,.04)}.metric-icon{display:grid;width:42px;height:42px;place-items:center;border:2px solid var(--green);border-radius:50%;color:var(--green);font-size:20px;font-weight:900}.metric.talk .metric-icon{border-color:var(--amber);color:var(--amber)}.metric.attention .metric-icon{border-color:var(--red);color:var(--red)}.metric strong{display:block;font-size:29px;line-height:1}.metric b{display:block;margin:4px 0;color:var(--ink);font-size:12px}.metric small{color:var(--grey);font-size:10px;line-height:1.35}
  .lead{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin:5px 0 24px;padding:20px 24px;border:1px solid #b8d2d7;border-left:7px solid var(--navy);border-radius:14px;background:linear-gradient(90deg,#e7f3f5,#f7fbfa)}.lead-icon{display:grid;width:55px;height:55px;place-items:center;border-radius:50%;background:var(--navy);color:#fff;font-size:23px}.lead h2{margin:0 0 5px;font-size:20px}.lead p{margin:0;color:#4f6865;font-size:12px;line-height:1.55}
  .layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.7fr);gap:20px;padding-bottom:70px}.main,.side{display:grid;gap:20px;align-content:start}.panel{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--paper);box-shadow:0 9px 30px rgba(16,47,42,.045)}.panel-head{display:flex;padding:20px 22px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.panel-head h2{margin:0;font-size:17px;letter-spacing:-.02em}.panel-head span{color:var(--grey);font-size:10px}.executive{display:grid;grid-template-columns:repeat(3,1fr)}.insight{min-height:190px;padding:23px}.insight+.insight{border-left:1px solid var(--line)}.insight-icon{display:grid;width:39px;height:39px;place-items:center;border-radius:11px;background:var(--blue);color:var(--navy);font-weight:900}.insight:nth-child(2) .insight-icon{background:var(--amber2);color:var(--amber)}.insight:nth-child(3) .insight-icon{background:var(--green2);color:var(--green)}.insight h3{margin:18px 0 8px;font-size:15px}.insight p{margin:0;color:var(--grey);font-size:11px;line-height:1.55}.facts{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);background:#fafbf9}.facts div{padding:14px 17px}.facts div+div{border-left:1px solid var(--line)}.facts span{display:block;color:var(--grey);font-size:9px;text-transform:uppercase}.facts b{display:block;margin-top:4px;font-size:12px}
  .questions{margin:0;padding:0;list-style:none}.question{display:grid;grid-template-columns:35px 1fr;gap:13px;padding:17px 21px}.question+.question{border-top:1px solid var(--line)}.q-number{display:grid;width:29px;height:29px;place-items:center;border-radius:9px;background:var(--navy);color:#fff;font-size:11px;font-weight:900}.question.attention .q-number{background:var(--red)}.question b{font-size:13px}.question p{margin:4px 0 0;color:var(--grey);font-size:11px;line-height:1.45}
  .check-list{background:#fff}.check-row{border-bottom:1px solid var(--line)}.check-row:last-child{border:0}.check-row summary{display:grid;grid-template-columns:34px 32px 1fr auto 18px;gap:10px;min-height:69px;padding:11px 17px;align-items:center;cursor:pointer;list-style:none}.check-row summary::-webkit-details-marker{display:none}.check-number{display:grid;width:29px;height:29px;place-items:center;border:1px solid var(--line);border-radius:50%;font-size:10px;font-weight:850}.check-symbol{display:grid;width:29px;height:29px;place-items:center;border-radius:9px;background:var(--green2);color:var(--green);font-weight:900}.talk .check-symbol{background:var(--amber2);color:var(--amber);font-size:9px}.attention .check-symbol{background:var(--red2);color:var(--red)}.check-title b{display:block;font-size:12px}.check-title small{display:block;margin-top:3px;color:var(--grey);font-size:10px;line-height:1.35}.status{padding:6px 9px;border-radius:999px;background:var(--green2);color:#397551;font-size:9px;font-weight:850}.talk .status{background:var(--amber2);color:#9a5a14}.attention .status{background:var(--red2);color:#9e4935}.chevron{color:#80908b}.check-detail{margin:0 17px 15px 93px;padding:14px;border-radius:10px;background:#f3f6f4}.check-detail b{font-size:9px;text-transform:uppercase}.check-detail p{margin:5px 0 0;color:var(--grey);font-size:11px;line-height:1.5}
  .captures{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:13px}.capture{overflow:hidden;margin:0;border:1px solid var(--line);border-radius:10px;background:#fafafa}.capture img{display:block;width:100%;height:115px;object-fit:cover;object-position:top}.capture figcaption{display:flex;padding:8px;justify-content:space-between;color:var(--grey);font-size:8px}.capture figcaption b{color:var(--ink)}.captures-expired{grid-column:1/-1;padding:25px 17px;text-align:center}.captures-expired>span{display:grid;width:50px;height:50px;margin:0 auto 12px;place-items:center;border-radius:50%;background:var(--blue);color:var(--navy);font-weight:900}.captures-expired b{display:block;font-size:12px}.captures-expired p{margin:6px 0 0;color:var(--grey);font-size:10px;line-height:1.45}
  .timeline{padding:19px 21px}.step{position:relative;display:grid;grid-template-columns:23px 1fr;gap:11px;padding-bottom:20px}.step:last-child{padding-bottom:0}.step:not(:last-child):after{content:"";position:absolute;left:10px;top:22px;bottom:0;width:2px;background:#c9ddd0}.step i{display:grid;width:22px;height:22px;place-items:center;border-radius:50%;background:var(--green);color:#fff;font-size:10px;font-style:normal}.step b{display:block;font-size:11px}.step span{display:block;margin-top:3px;color:var(--grey);font-size:9px}.photo-list{margin:0;padding:0;list-style:none}.photo-row{display:grid;grid-template-columns:27px 1fr auto;gap:10px;padding:14px 18px;align-items:center}.photo-row+.photo-row{border-top:1px solid var(--line)}.photo-row>span{display:grid;width:25px;height:25px;place-items:center;border-radius:7px;background:var(--green2);color:var(--green);font-size:9px;font-weight:900}.photo-row.attention>span{background:var(--red2);color:var(--red)}.photo-row b{display:block;font-size:10px}.photo-row small{display:block;margin-top:3px;color:var(--grey);font-size:9px;line-height:1.35}.photo-row a{color:var(--navy);font-size:9px;font-weight:850;text-decoration:none}.photo-empty{padding:20px;color:var(--grey);font-size:10px}.source-links{display:flex;flex-wrap:wrap;gap:7px;padding:0 18px 16px}.source-links a{padding:6px 8px;border-radius:7px;background:var(--blue);color:var(--navy);font-size:9px;font-weight:800;text-decoration:none}
  .gates{display:grid;grid-template-columns:56px 1fr;gap:18px;padding:22px;background:linear-gradient(125deg,#123d49,#0c302a);color:#fff}.gate-icon{display:grid;width:54px;height:54px;place-items:center;border:1px solid #7fa1a5;border-radius:50%;font-size:22px}.gates h2{margin:0 0 13px;font-family:Georgia,serif;font-size:20px}.gate-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.gate{display:flex;gap:8px;color:#dce8e4;font-size:10px;line-height:1.4}.gate:before{content:"✓";color:#d9f76d;font-weight:900}.fine{padding:18px 0 35px;color:#71817c;font-size:9px;line-height:1.6}.footer{padding:25px 0;background:#0c302a;color:#b8cbc5}.footer .page{display:flex;justify-content:space-between;font-size:9px}.footer b{color:#fff}
  @media(max-width:950px){.summary{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}.side{grid-template-columns:repeat(2,1fr)}.side .panel:first-child,.side .panel:last-child{grid-column:1/-1}}
  @media(max-width:680px){.page{width:min(100% - 22px,1240px)}.topbar .page{min-height:60px}.brand{font-size:13px}.private{font-size:8px}.report-head{padding:34px 0 20px}.head-grid{grid-template-columns:1fr}.head-note{display:none}.report-head h1{font-size:39px}.summary{grid-template-columns:1fr 1fr;gap:8px}.metric{grid-template-columns:36px 1fr;min-height:105px;padding:14px}.metric-icon{width:35px;height:35px}.metric strong{font-size:24px}.coverage{grid-column:1/-1}.lead{grid-template-columns:1fr;padding:18px}.lead-icon{display:none}.layout{gap:13px}.executive{grid-template-columns:1fr}.insight{min-height:auto}.insight+.insight{border-left:0;border-top:1px solid var(--line)}.facts{grid-template-columns:repeat(2,1fr)}.facts div:nth-child(odd){border-left:0}.facts div:nth-child(n+3){border-top:1px solid var(--line)}.check-row summary{grid-template-columns:29px 27px 1fr 17px;padding:10px}.status{grid-column:3;width:max-content}.chevron{grid-column:4;grid-row:1/3}.check-title small{display:none}.check-detail{margin:0 10px 10px}.side{grid-template-columns:1fr}.side .panel:first-child,.side .panel:last-child{grid-column:auto}.gate-grid{grid-template-columns:1fr}.gates{grid-template-columns:1fr}.gate-icon{display:none}.footer .page{gap:15px;flex-direction:column}}
  .decision{display:grid;grid-template-columns:74px 1fr;gap:24px;align-items:start;margin:28px 0 8px;padding:30px 34px;border-radius:24px;box-shadow:0 24px 58px rgba(16,47,42,.15)}.decision.danger{background:linear-gradient(135deg,#9b3829,#d05b37);color:#fff}.decision.caution{background:linear-gradient(135deg,#123f49,#0d6255);color:#fff}.decision.positive{background:linear-gradient(135deg,#164d3e,#32835f);color:#fff}.decision-icon{display:grid;width:68px;height:68px;place-items:center;border:1px solid rgba(255,255,255,.45);border-radius:20px;background:rgba(255,255,255,.13);font-size:31px;font-weight:950}.decision-label{display:inline-block;margin-bottom:8px;padding:6px 10px;border-radius:999px;background:#d9ff72;color:#123c32;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.decision h2{max-width:840px;margin:0;font-size:clamp(25px,3.5vw,44px);line-height:1.05;letter-spacing:-.04em}.decision p{max-width:820px;margin:12px 0;color:rgba(255,255,255,.86);font-size:13px;line-height:1.6}.decision-rule{display:block;color:#fff;font-size:11px}.summary{grid-template-columns:repeat(3,1fr);padding:16px 0 22px}.risk-stack{display:grid;gap:11px;padding:18px}.risk-item,.risk-clear{display:grid;grid-template-columns:42px 1fr;gap:14px;padding:17px;border-radius:13px}.risk-item{border:1px solid #f0c3b7;background:#fff5f1}.risk-clear{border:1px solid #c8dfd0;background:#f1f8f2}.risk-item>span,.risk-clear>span{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;background:var(--red);color:#fff;font-weight:950}.risk-clear>span{background:var(--green)}.risk-item b,.risk-clear b{font-size:13px}.risk-item p,.risk-clear p{margin:5px 0;color:var(--grey);font-size:11px;line-height:1.5}.risk-item small{display:block;padding-top:8px;border-top:1px solid #efd8d1;color:#743e32;font-size:10px;line-height:1.45}.message-box{overflow:hidden;border-radius:20px;background:linear-gradient(145deg,#0b302b,#164d44);color:#fff;box-shadow:var(--shadow)}.message-head{padding:25px 27px 15px}.message-head>span{color:#d9ff72;font-size:9px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.message-head h2{margin:6px 0 5px;font-size:25px;letter-spacing:-.035em}.message-head p{margin:0;color:#bdd1cb;font-size:11px}.message-box textarea{display:block;width:calc(100% - 40px);min-height:210px;margin:4px 20px 20px;padding:19px;border:1px solid rgba(255,255,255,.17);border-radius:13px;outline:0;background:#fff;color:#173b35;font:500 12px/1.65 Inter,Aptos,"Segoe UI",Arial,sans-serif;resize:vertical}.conditions{margin:0;padding:4px 18px 18px;list-style:none}.conditions li{display:grid;grid-template-columns:30px 1fr;gap:11px;padding:14px 5px}.conditions li+li{border-top:1px solid var(--line)}.conditions li>span{display:grid;width:27px;height:27px;place-items:center;border-radius:8px;background:var(--amber2);color:var(--amber);font-weight:900}.conditions b{font-size:12px}.conditions p{margin:4px 0 0;color:var(--grey);font-size:10px;line-height:1.45}.price-card{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;padding:24px;border:1px solid #c9dfd1;border-radius:17px;background:linear-gradient(120deg,#f4fbf3,#e8f5eb);box-shadow:0 9px 30px rgba(16,47,42,.045)}.price-card>div{display:grid;gap:5px}.price-card span{color:var(--grey);font-size:9px;font-weight:850;text-transform:uppercase}.price-card strong{font-size:24px}.price-card i{color:#7e918b;font-size:9px;font-style:normal;text-transform:uppercase}.price-card p{grid-column:1/-1;margin:2px 0 0;color:var(--grey);font-size:10px}.price-card a{grid-column:1/-1;width:max-content;color:var(--navy);font-size:10px;font-weight:850;text-decoration:none}.photo-summary{display:grid;grid-template-columns:40px 1fr;gap:12px;padding:18px}.photo-summary>span{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;background:var(--green2);color:var(--green);font-weight:950}.photo-summary.attention>span{background:var(--red2);color:var(--red)}.photo-summary b{display:block;font-size:12px;line-height:1.35}.photo-summary p{margin:5px 0 0;color:var(--grey);font-size:10px;line-height:1.45}.photo-panel .photo-list{border-top:1px solid var(--line)}.details-panel .panel-head{background:#f8faf8}
  @media(max-width:680px){.decision{grid-template-columns:1fr;gap:15px;padding:24px}.decision-icon{width:52px;height:52px;border-radius:15px;font-size:24px}.decision h2{font-size:30px}.summary{grid-template-columns:1fr}.metric{min-height:auto}.price-card{grid-template-columns:1fr}.price-card i{display:none}.message-box textarea{min-height:270px}.risk-item,.risk-clear{grid-template-columns:34px 1fr;padding:14px}.risk-item>span,.risk-clear>span{width:32px;height:32px}}
  </style></head><body>
  <nav class="topbar"><div class="page"><div class="brand"><i>GP</i>Guia do Proprietário</div><div class="private">Relatório privado</div></div></nav>
  <header class="report-head"><div class="page head-grid"><div><p class="kicker">Verificação de Anúncio</p><h1>A decisão antes de pagar<span>O que encontrámos, o que significa e o que deve fazer agora</span></h1><div class="created">Análise concluída em ${escapeHtml(datePt(createdAt))}</div></div><aside class="head-note"><b>Um relatório orientado à decisão</b>A ausência de informação no anúncio não é tratada como sinal de risco. Destacamos apenas o que tem evidência concreta.</aside></div></header>
  <main class="page">
    <section class="decision ${escapeHtml(verdict.tone)}"><div class="decision-icon">${verdict.tone === "danger" ? "!" : verdict.tone === "caution" ? "→" : "✓"}</div><div><span class="decision-label">${escapeHtml(verdict.label)}</span><h2>${escapeHtml(verdict.title)}</h2><p>${escapeHtml(verdict.text)}</p><strong class="decision-rule">Regra prática: visita, identidade e minuta antes de qualquer transferência.</strong></div></section>
    <section class="summary"><article class="metric found"><span class="metric-icon">✓</span><div><strong>${found.length}</strong><b>informações encontradas</b><small>Sustentadas nas capturas analisadas</small></div></article><article class="metric attention"><span class="metric-icon">!</span><div><strong>${signalCount}</strong><b>sinais concretos</b><small>Não incluem simples omissões do anúncio</small></div></article><article class="metric talk"><span class="metric-icon">→</span><div><strong>${questions.length}</strong><b>perguntas preparadas</b><small>Prontas para enviar ao anunciante</small></div></article></section>
    <div class="layout"><div class="main">
      <section class="panel"><header class="panel-head"><h2>Sinais relevantes antes de pagar</h2><span>${signalCount ? signalCount + (signalCount === 1 ? " sinal observado" : " sinais observados") : "nenhum sinal concreto"}</span></header><div class="risk-stack">${riskCards}</div>${facts}</section>
      ${priceCard}
      <section class="message-box"><div class="message-head"><span>Mensagem pronta</span><h2>Envie isto ao anunciante.</h2><p>O texto já reúne as perguntas prioritárias deste anúncio. Selecione e copie.</p></div><textarea readonly aria-label="Mensagem pronta para enviar ao anunciante">${escapeHtml(contactMessage)}</textarea></section>
      <section class="panel"><header class="panel-head"><h2>O que deixar fechado na conversa e no contrato</h2><span>Boa prática, não acusação</span></header><ul class="conditions">${contractRows}</ul></section>
      <section class="panel details-panel"><header class="panel-head"><h2>Evidência detalhada</h2><span>12 verificações, abra para consultar</span></header><div class="check-list">${checkRows}</div></section>
      <section class="gates"><span class="gate-icon">✓</span><div><h2>Antes de transferir dinheiro</h2><div class="gate-grid"><span class="gate">Visite o imóvel ou faça uma videochamada em direto.</span><span class="gate">Confirme quem pode legitimamente arrendar o imóvel.</span><span class="gate">Leia a minuta e valide todos os valores por escrito.</span><span class="gate">Pague apenas para um titular relacionado com o contrato.</span></div></div></section>
    </div><aside class="side">
      <section class="panel photo-panel"><header class="panel-head"><h2>Pesquisa das fotografias</h2><span>${photoCount} ${photoCount === 1 ? "fotografia" : "fotografias"}</span></header><div class="photo-summary ${differentContext.length ? "attention" : "found"}"><span>${differentContext.length ? "!" : "⌕"}</span><div><b>${escapeHtml(photoSummaryTitle)}</b><p>${escapeHtml(photoSummaryText)}</p></div></div>${photoRows ? `<ul class="photo-list">${photoRows}</ul>` : ""}${sources ? `<div class="source-links">${sources}</div>` : ""}</section>
      <section class="panel"><header class="panel-head"><h2>Capturas analisadas</h2><span>${capturePreviews.length ? `${capturePreviews.length} evidências` : "retidas durante 48 h"}</span></header><div class="captures">${previews}</div></section>
      <section class="panel"><header class="panel-head"><h2>Como analisámos</h2><span>Processo concluído</span></header><div class="timeline"><div class="step"><i>✓</i><div><b>Capturas recebidas</b><span>Ligação privada e armazenamento temporário</span></div></div><div class="step"><i>✓</i><div><b>Informação extraída</b><span>Texto, condições e fotografias separados</span></div></div><div class="step"><i>✓</i><div><b>Fotografias pesquisadas</b><span>${photoCount} ${photoCount === 1 ? "imagem comparada" : "imagens comparadas"} em fontes públicas</span></div></div><div class="step"><i>✓</i><div><b>12 pontos cruzados</b><span>Relatório concluído em ${escapeHtml(datePt(createdAt))}</span></div></div></div></section>
    </aside></div>
    <p class="fine"><b>Como interpretar:</b> este relatório destaca sinais observáveis e prepara a validação antes do pagamento. Não certifica identidades, propriedade ou autenticidade do anúncio. Uma pesquisa sem correspondências também não prova que uma fotografia seja original.</p>
  </main><footer class="footer"><div class="page"><b>Guia do Proprietário</b><span>Ligação privada disponível até ${escapeHtml(datePt(expiresAt))}</span></div></footer>
  </body></html>`;
}
