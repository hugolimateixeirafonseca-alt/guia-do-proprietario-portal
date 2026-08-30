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

const readingFor = (check) => {
  if (check.reading) return check.reading;
  if (check.state === "confirmado") return "informacao_encontrada";
  if (/contradi|diferença|outro contexto|antes da visita|recusa/iu.test(check.observation || "")) return "sinal_atencao";
  return "confirmar_na_conversa";
};

const readingMeta = (reading) => ({
  informacao_encontrada: { label: "Encontrado", icon: "✓", tone: "found" },
  confirmar_na_conversa: { label: "Alinhar na chamada", icon: "●", tone: "talk" },
  sinal_atencao: { label: "Merece atenção", icon: "!", tone: "attention" }
}[reading] || { label: "Alinhar na chamada", icon: "●", tone: "talk" });

const actionFor = (check) => check.action || VERIFICATION_BY_ID.get(Number(check.id))?.action || "Confirme este ponto na conversa antes de avançar.";

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
  const readings = checks.map((check) => ({ ...check, reading: readingFor(check) }));
  const found = readings.filter((check) => check.reading === "informacao_encontrada");
  const talk = readings.filter((check) => check.reading === "confirmar_na_conversa");
  const attention = readings.filter((check) => check.reading === "sinal_atencao");
  const reverseEvidence = report?.reverseImageEvidence ?? [];
  const photoCount = new Set(reverseEvidence.map((item) => item.photo_id || item.image_id || item.id).filter(Boolean)).size || reverseEvidence.length;
  const externalMatches = reverseEvidence.filter((item) => ["correspondencia_mesmo_contexto", "correspondencia_contexto_diferente", "correspondencia_inconclusiva"].includes(item.state));
  const differentContext = reverseEvidence.filter((item) => item.state === "correspondencia_contexto_diferente");
  const signalCount = attention.length + (differentContext.length && !attention.some((check) => Number(check.id) === 4) ? differentContext.length : 0);
  const observedFacts = (report?.observedFacts ?? []).filter((item) => factLabels[item.field]).slice(0, 8);
  const payment = readings.find((check) => Number(check.id) === 6);
  const visit = readings.find((check) => Number(check.id) === 7);
  const contract = readings.find((check) => Number(check.id) === 8);
  const coverage = checks.length ? Math.round((found.length / checks.length) * 100) : 0;

  const executivePhoto = differentContext.length
    ? `${differentContext.length} ${differentContext.length === 1 ? "fotografia aparece" : "fotografias aparecem"} associada a outro contexto público. Veja as fontes e peça esclarecimento.`
    : externalMatches.length
      ? `A pesquisa encontrou ${externalMatches.length} ${externalMatches.length === 1 ? "correspondência pública" : "correspondências públicas"}. Consulte o detalhe antes da chamada.`
      : `${photoCount || "As"} ${photoCount === 1 ? "fotografia foi pesquisada" : "fotografias foram pesquisadas"}. Não surgiu uma correspondência pública relevante para apresentar.`;

  const executivePayment = payment?.reading === "informacao_encontrada"
    ? payment.observation
    : "O anúncio não fecha todos os valores e momentos de pagamento. Leve a pergunta preparada para obter a discriminação completa.";
  const executiveLogistics = visit?.reading === "informacao_encontrada" && contract?.reading === "informacao_encontrada"
    ? "A visita presencial e o contrato escrito são mencionados. Confirme datas e peça a minuta antes de qualquer transferência."
    : "Use a chamada para marcar a visita e confirmar quando recebe a minuta do contrato. Estes dois passos devem anteceder o pagamento.";

  const questions = readings
    .filter((check) => check.reading !== "informacao_encontrada")
    .sort((a, b) => priorityOrder.indexOf(Number(a.id)) - priorityOrder.indexOf(Number(b.id)))
    .slice(0, 5);

  const questionCards = questions.map((check, index) => {
    const meta = readingMeta(check.reading);
    return `<li class="question ${meta.tone}"><span class="q-number">${index + 1}</span><div><b>${escapeHtml(check.name)}</b><p>${escapeHtml(actionFor(check))}</p></div></li>`;
  }).join("");

  const checkRows = readings.map((check) => {
    const meta = readingMeta(check.reading);
    return `<details class="check-row ${meta.tone}">
      <summary><span class="check-number">${String(check.id).padStart(2, "0")}</span><span class="check-symbol">${meta.icon}</span><span class="check-title"><b>${escapeHtml(check.name)}</b><small>${escapeHtml(check.observation)}</small></span><span class="status">${escapeHtml(meta.label)}</span><span class="chevron">⌄</span></summary>
      <div class="check-detail">${check.reading === "informacao_encontrada" ? `<b>O que sustentou esta leitura</b><p>${escapeHtml(check.observation)}</p>` : `<b>Como fechar este ponto</b><p>${escapeHtml(actionFor(check))}</p>`}</div>
    </details>`;
  }).join("");

  const previews = capturePreviews.length ? capturePreviews.map((item, index) => `<figure class="capture"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" loading="lazy"><figcaption><span>${escapeHtml(item.label)}</span><b>Evidência ${String(index + 1).padStart(2, "0")}</b></figcaption></figure>`).join("") : `<div class="captures-expired"><span>48h</span><b>As capturas já foram eliminadas.</b><p>O relatório conserva apenas as conclusões. As imagens originais são apagadas automaticamente.</p></div>`;

  const facts = observedFacts.length ? `<div class="facts">${observedFacts.map((item) => `<div><span>${escapeHtml(factLabels[item.field])}</span><b>${escapeHtml(item.value)}</b></div>`).join("")}</div>` : "";

  const photoRows = reverseEvidence.length ? reverseEvidence.slice(0, 6).map((item, index) => {
    const meta = photoResultMeta(item.state);
    return `<li class="photo-row ${meta.tone}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(meta.label)}</b>${item.context_excerpt ? `<small>${escapeHtml(item.context_excerpt)}</small>` : ""}</div>${item.source_url ? `<a href="${escapeHtml(item.source_url)}" rel="nofollow noreferrer" target="_blank">Fonte ↗</a>` : ""}</li>`;
  }).join("") : `<li class="photo-empty">Não foram extraídas fotografias utilizáveis para pesquisa externa.</li>`;

  const sources = reverseEvidence.filter((item) => item.source_url).map((item) => `<a href="${escapeHtml(item.source_url)}" rel="nofollow noreferrer" target="_blank">${escapeHtml(item.source_domain || "Fonte pública")} ↗</a>`).join("");
  const leadTitle = signalCount
    ? `${signalCount} ${signalCount === 1 ? "ponto merece" : "pontos merecem"} atenção antes de avançar.`
    : talk.length
      ? `A próxima chamada deve fechar ${talk.length} ${talk.length === 1 ? "assunto" : "assuntos"}.`
      : "O anúncio reúne a informação principal para avançar para a visita.";
  const leadText = signalCount
    ? "Há sinais concretos que justificam esclarecimento. Não resultam apenas de informação ausente no anúncio."
    : "Não tratámos a ausência de texto como problema. Organizámos o que deve confirmar por telefone, na visita e no contrato.";

  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light"><title>Relatório privado | Verificação de Anúncio</title><style>
  :root{--ink:#102f2a;--navy:#173e4b;--green:#3e875d;--green2:#eaf4ea;--blue:#eaf3f5;--cream:#f5f3ed;--paper:#fff;--amber:#d8811d;--amber2:#fff1dc;--grey:#687773;--line:#dde4df;--red:#bb563f;--red2:#fff0eb;--shadow:0 18px 55px rgba(16,47,42,.09)}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Aptos,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}.page{width:min(1240px,calc(100% - 36px));margin:auto}.topbar{background:#0c302a;color:#fff}.topbar .page{display:flex;min-height:68px;align-items:center;justify-content:space-between}.brand{display:flex;gap:11px;align-items:center;font-weight:850}.brand i{display:grid;width:36px;height:36px;place-items:center;border-radius:10px;background:#d9f76d;color:#173b32;font-size:12px;font-style:normal}.private{display:flex;gap:8px;align-items:center;color:#c9d8d3;font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.private:before{content:"";width:7px;height:7px;border-radius:50%;background:#d9f76d}
  .report-head{padding:48px 0 29px;background:linear-gradient(145deg,#fff,#f3f6f2)}.head-grid{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:end}.kicker{margin:0 0 11px;color:var(--green);font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.report-head h1{max-width:820px;margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(38px,5.4vw,65px);line-height:1;letter-spacing:-.045em}.report-head h1 span{display:block;margin-top:7px;color:var(--navy);font-size:.56em;line-height:1.15;letter-spacing:-.025em}.created{display:flex;gap:9px;align-items:center;margin-top:22px;color:var(--grey);font-size:11px}.created:before{content:"";width:15px;height:15px;border:2px solid #83918d;border-radius:4px}.head-note{max-width:290px;padding:18px 20px;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--grey);font-size:12px;line-height:1.55}.head-note b{display:block;margin-bottom:4px;color:var(--ink);font-size:13px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr) 1.12fr;gap:13px;padding:22px 0}.metric{display:grid;grid-template-columns:44px 1fr;gap:12px;min-height:116px;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:0 8px 28px rgba(16,47,42,.04)}.metric-icon{display:grid;width:42px;height:42px;place-items:center;border:2px solid var(--green);border-radius:50%;color:var(--green);font-size:20px;font-weight:900}.metric.talk .metric-icon{border-color:var(--amber);color:var(--amber)}.metric.attention .metric-icon{border-color:var(--red);color:var(--red)}.metric strong{display:block;font-size:29px;line-height:1}.metric b{display:block;margin:4px 0;color:var(--ink);font-size:12px}.metric small{color:var(--grey);font-size:10px;line-height:1.35}.coverage{display:grid;grid-template-columns:78px 1fr;gap:16px;align-items:center;padding:17px 19px;border:1px solid #ccdcdf;border-radius:16px;background:var(--blue)}.ring{display:grid;width:76px;height:76px;place-items:center;border-radius:50%;background:conic-gradient(var(--navy) 0 ${coverage}%,#d6e2e4 ${coverage}% 100%)}.ring:before{content:"";position:absolute;width:59px;height:59px;border-radius:50%;background:#fff}.ring b{position:relative;font-size:19px}.coverage span{display:block;color:var(--grey);font-size:10px;font-weight:800;text-transform:uppercase}.coverage strong{display:block;margin:5px 0;font-size:14px}.coverage p{margin:0;color:var(--grey);font-size:10px;line-height:1.4}
  .lead{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin:5px 0 24px;padding:20px 24px;border:1px solid #b8d2d7;border-left:7px solid var(--navy);border-radius:14px;background:linear-gradient(90deg,#e7f3f5,#f7fbfa)}.lead-icon{display:grid;width:55px;height:55px;place-items:center;border-radius:50%;background:var(--navy);color:#fff;font-size:23px}.lead h2{margin:0 0 5px;font-size:20px}.lead p{margin:0;color:#4f6865;font-size:12px;line-height:1.55}
  .layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.7fr);gap:20px;padding-bottom:70px}.main,.side{display:grid;gap:20px;align-content:start}.panel{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--paper);box-shadow:0 9px 30px rgba(16,47,42,.045)}.panel-head{display:flex;padding:20px 22px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.panel-head h2{margin:0;font-size:17px;letter-spacing:-.02em}.panel-head span{color:var(--grey);font-size:10px}.executive{display:grid;grid-template-columns:repeat(3,1fr)}.insight{min-height:190px;padding:23px}.insight+.insight{border-left:1px solid var(--line)}.insight-icon{display:grid;width:39px;height:39px;place-items:center;border-radius:11px;background:var(--blue);color:var(--navy);font-weight:900}.insight:nth-child(2) .insight-icon{background:var(--amber2);color:var(--amber)}.insight:nth-child(3) .insight-icon{background:var(--green2);color:var(--green)}.insight h3{margin:18px 0 8px;font-size:15px}.insight p{margin:0;color:var(--grey);font-size:11px;line-height:1.55}.facts{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);background:#fafbf9}.facts div{padding:14px 17px}.facts div+div{border-left:1px solid var(--line)}.facts span{display:block;color:var(--grey);font-size:9px;text-transform:uppercase}.facts b{display:block;margin-top:4px;font-size:12px}
  .questions{margin:0;padding:0;list-style:none}.question{display:grid;grid-template-columns:35px 1fr;gap:13px;padding:17px 21px}.question+.question{border-top:1px solid var(--line)}.q-number{display:grid;width:29px;height:29px;place-items:center;border-radius:9px;background:var(--navy);color:#fff;font-size:11px;font-weight:900}.question.attention .q-number{background:var(--red)}.question b{font-size:13px}.question p{margin:4px 0 0;color:var(--grey);font-size:11px;line-height:1.45}
  .check-list{background:#fff}.check-row{border-bottom:1px solid var(--line)}.check-row:last-child{border:0}.check-row summary{display:grid;grid-template-columns:34px 32px 1fr auto 18px;gap:10px;min-height:69px;padding:11px 17px;align-items:center;cursor:pointer;list-style:none}.check-row summary::-webkit-details-marker{display:none}.check-number{display:grid;width:29px;height:29px;place-items:center;border:1px solid var(--line);border-radius:50%;font-size:10px;font-weight:850}.check-symbol{display:grid;width:29px;height:29px;place-items:center;border-radius:9px;background:var(--green2);color:var(--green);font-weight:900}.talk .check-symbol{background:var(--amber2);color:var(--amber);font-size:9px}.attention .check-symbol{background:var(--red2);color:var(--red)}.check-title b{display:block;font-size:12px}.check-title small{display:block;margin-top:3px;color:var(--grey);font-size:10px;line-height:1.35}.status{padding:6px 9px;border-radius:999px;background:var(--green2);color:#397551;font-size:9px;font-weight:850}.talk .status{background:var(--amber2);color:#9a5a14}.attention .status{background:var(--red2);color:#9e4935}.chevron{color:#80908b}.check-detail{margin:0 17px 15px 93px;padding:14px;border-radius:10px;background:#f3f6f4}.check-detail b{font-size:9px;text-transform:uppercase}.check-detail p{margin:5px 0 0;color:var(--grey);font-size:11px;line-height:1.5}
  .captures{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:13px}.capture{overflow:hidden;margin:0;border:1px solid var(--line);border-radius:10px;background:#fafafa}.capture img{display:block;width:100%;height:115px;object-fit:cover;object-position:top}.capture figcaption{display:flex;padding:8px;justify-content:space-between;color:var(--grey);font-size:8px}.capture figcaption b{color:var(--ink)}.captures-expired{grid-column:1/-1;padding:25px 17px;text-align:center}.captures-expired>span{display:grid;width:50px;height:50px;margin:0 auto 12px;place-items:center;border-radius:50%;background:var(--blue);color:var(--navy);font-weight:900}.captures-expired b{display:block;font-size:12px}.captures-expired p{margin:6px 0 0;color:var(--grey);font-size:10px;line-height:1.45}
  .timeline{padding:19px 21px}.step{position:relative;display:grid;grid-template-columns:23px 1fr;gap:11px;padding-bottom:20px}.step:last-child{padding-bottom:0}.step:not(:last-child):after{content:"";position:absolute;left:10px;top:22px;bottom:0;width:2px;background:#c9ddd0}.step i{display:grid;width:22px;height:22px;place-items:center;border-radius:50%;background:var(--green);color:#fff;font-size:10px;font-style:normal}.step b{display:block;font-size:11px}.step span{display:block;margin-top:3px;color:var(--grey);font-size:9px}.photo-list{margin:0;padding:0;list-style:none}.photo-row{display:grid;grid-template-columns:27px 1fr auto;gap:10px;padding:14px 18px;align-items:center}.photo-row+.photo-row{border-top:1px solid var(--line)}.photo-row>span{display:grid;width:25px;height:25px;place-items:center;border-radius:7px;background:var(--green2);color:var(--green);font-size:9px;font-weight:900}.photo-row.attention>span{background:var(--red2);color:var(--red)}.photo-row b{display:block;font-size:10px}.photo-row small{display:block;margin-top:3px;color:var(--grey);font-size:9px;line-height:1.35}.photo-row a{color:var(--navy);font-size:9px;font-weight:850;text-decoration:none}.photo-empty{padding:20px;color:var(--grey);font-size:10px}.source-links{display:flex;flex-wrap:wrap;gap:7px;padding:0 18px 16px}.source-links a{padding:6px 8px;border-radius:7px;background:var(--blue);color:var(--navy);font-size:9px;font-weight:800;text-decoration:none}
  .gates{display:grid;grid-template-columns:56px 1fr;gap:18px;padding:22px;background:linear-gradient(125deg,#123d49,#0c302a);color:#fff}.gate-icon{display:grid;width:54px;height:54px;place-items:center;border:1px solid #7fa1a5;border-radius:50%;font-size:22px}.gates h2{margin:0 0 13px;font-family:Georgia,serif;font-size:20px}.gate-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.gate{display:flex;gap:8px;color:#dce8e4;font-size:10px;line-height:1.4}.gate:before{content:"✓";color:#d9f76d;font-weight:900}.fine{padding:18px 0 35px;color:#71817c;font-size:9px;line-height:1.6}.footer{padding:25px 0;background:#0c302a;color:#b8cbc5}.footer .page{display:flex;justify-content:space-between;font-size:9px}.footer b{color:#fff}
  @media(max-width:950px){.summary{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}.side{grid-template-columns:repeat(2,1fr)}.side .panel:first-child,.side .panel:last-child{grid-column:1/-1}}
  @media(max-width:680px){.page{width:min(100% - 22px,1240px)}.topbar .page{min-height:60px}.brand{font-size:13px}.private{font-size:8px}.report-head{padding:34px 0 20px}.head-grid{grid-template-columns:1fr}.head-note{display:none}.report-head h1{font-size:39px}.summary{grid-template-columns:1fr 1fr;gap:8px}.metric{grid-template-columns:36px 1fr;min-height:105px;padding:14px}.metric-icon{width:35px;height:35px}.metric strong{font-size:24px}.coverage{grid-column:1/-1}.lead{grid-template-columns:1fr;padding:18px}.lead-icon{display:none}.layout{gap:13px}.executive{grid-template-columns:1fr}.insight{min-height:auto}.insight+.insight{border-left:0;border-top:1px solid var(--line)}.facts{grid-template-columns:repeat(2,1fr)}.facts div:nth-child(odd){border-left:0}.facts div:nth-child(n+3){border-top:1px solid var(--line)}.check-row summary{grid-template-columns:29px 27px 1fr 17px;padding:10px}.status{grid-column:3;width:max-content}.chevron{grid-column:4;grid-row:1/3}.check-title small{display:none}.check-detail{margin:0 10px 10px}.side{grid-template-columns:1fr}.side .panel:first-child,.side .panel:last-child{grid-column:auto}.gate-grid{grid-template-columns:1fr}.gates{grid-template-columns:1fr}.gate-icon{display:none}.footer .page{gap:15px;flex-direction:column}}
  </style></head><body>
  <nav class="topbar"><div class="page"><div class="brand"><i>GP</i>Guia do Proprietário</div><div class="private">Relatório privado</div></div></nav>
  <header class="report-head"><div class="page head-grid"><div><p class="kicker">Verificação de Anúncio</p><h1>Relatório da análise<span>O que levar para a chamada, a visita e o contrato</span></h1><div class="created">Análise concluída em ${escapeHtml(datePt(createdAt))}</div></div><aside class="head-note"><b>Uma leitura para decidir melhor</b>Não penalizamos um anúncio por não explicar tudo. Separamos o que foi observado do que é normal confirmar na conversa.</aside></div></header>
  <main class="page">
    <section class="summary"><article class="metric found"><span class="metric-icon">✓</span><div><strong>${found.length}</strong><b>encontrados</b><small>Informação sustentada nas capturas</small></div></article><article class="metric talk"><span class="metric-icon">●</span><div><strong>${talk.length}</strong><b>para a chamada</b><small>Assuntos normais para alinhar</small></div></article><article class="metric attention"><span class="metric-icon">!</span><div><strong>${signalCount}</strong><b>merecem atenção</b><small>Apenas sinais concretos observados</small></div></article><article class="coverage"><div class="ring"><b>${coverage}%</b></div><div><span>Cobertura observável</span><strong>${found.length} de 12 pontos</strong><p>Não é uma pontuação de risco nem de confiança.</p></div></article></section>
    <section class="lead"><span class="lead-icon">◎</span><div><h2>${escapeHtml(leadTitle)}</h2><p>${escapeHtml(leadText)}</p></div></section>
    <div class="layout"><div class="main">
      <section class="panel"><header class="panel-head"><h2>Leitura executiva</h2><span>O essencial da análise</span></header><div class="executive"><article class="insight"><span class="insight-icon">⌕</span><h3>Pesquisa das fotografias</h3><p>${escapeHtml(executivePhoto)}</p></article><article class="insight"><span class="insight-icon">€</span><h3>Condições de pagamento</h3><p>${escapeHtml(executivePayment)}</p></article><article class="insight"><span class="insight-icon">⌂</span><h3>Visita e contrato</h3><p>${escapeHtml(executiveLogistics)}</p></article></div>${facts}</section>
      <section class="panel"><header class="panel-head"><h2>Guião para a próxima chamada</h2><span>${questions.length} perguntas prioritárias</span></header><ol class="questions">${questionCards || `<li class="question found"><span class="q-number">✓</span><div><b>Avance para a visita</b><p>Use a visita para confirmar o estado do imóvel e peça a minuta do contrato antes de pagar.</p></div></li>`}</ol></section>
      <section class="panel"><header class="panel-head"><h2>As 12 verificações</h2><span>Abra cada linha para ver o detalhe</span></header><div class="check-list">${checkRows}</div></section>
      <section class="gates"><span class="gate-icon">✓</span><div><h2>Antes de transferir dinheiro</h2><div class="gate-grid"><span class="gate">Visite o imóvel ou faça uma videochamada em direto.</span><span class="gate">Confirme quem pode legitimamente arrendar o imóvel.</span><span class="gate">Leia a minuta e valide todos os valores por escrito.</span><span class="gate">Pague apenas para um titular relacionado com o contrato.</span></div></div></section>
    </div><aside class="side">
      <section class="panel"><header class="panel-head"><h2>Capturas analisadas</h2><span>${capturePreviews.length ? `${capturePreviews.length} evidências` : "retidas durante 48 h"}</span></header><div class="captures">${previews}</div></section>
      <section class="panel"><header class="panel-head"><h2>Como analisámos</h2><span>Processo concluído</span></header><div class="timeline"><div class="step"><i>✓</i><div><b>Capturas recebidas</b><span>Ligação privada e armazenamento temporário</span></div></div><div class="step"><i>✓</i><div><b>Informação extraída</b><span>Texto, condições e fotografias separados</span></div></div><div class="step"><i>✓</i><div><b>Fotografias pesquisadas</b><span>${photoCount} ${photoCount === 1 ? "imagem comparada" : "imagens comparadas"} em fontes públicas</span></div></div><div class="step"><i>✓</i><div><b>12 pontos cruzados</b><span>Relatório concluído em ${escapeHtml(datePt(createdAt))}</span></div></div></div></section>
      <section class="panel"><header class="panel-head"><h2>Pesquisa visual</h2><span>${photoCount} fotografias</span></header><ul class="photo-list">${photoRows}</ul>${sources ? `<div class="source-links">${sources}</div>` : ""}</section>
    </aside></div>
    <p class="fine"><b>Como interpretar:</b> este relatório organiza a informação observável e prepara os próximos passos. “Sem correspondência encontrada” não prova que uma fotografia seja original. O serviço não certifica identidades nem garante a autenticidade do anúncio.</p>
  </main><footer class="footer"><div class="page"><b>Guia do Proprietário</b><span>Ligação privada disponível até ${escapeHtml(datePt(expiresAt))}</span></div></footer>
  </body></html>`;
}
