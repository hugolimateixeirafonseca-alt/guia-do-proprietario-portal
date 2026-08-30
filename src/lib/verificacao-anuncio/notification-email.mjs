const TYPES = new Set(["recebida", "relatorio", "falha", "lembrete_24h", "lembrete_7d", "reembolso"]);

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function checkedHttpsUrl(value, label) {
  const url = new URL(String(value ?? ""));
  if (url.protocol !== "https:") throw new TypeError(`${label} tem de usar HTTPS.`);
  return url.toString();
}

function datePt(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(parsed);
}

function copyFor(type, { uploadUrl, reportUrl, deadline }) {
  const deadlineText = datePt(deadline);
  const copies = {
    recebida: {
      subject: "Pagamento confirmado: envie as capturas do anúncio",
      eyebrow: "Pagamento confirmado",
      title: "Vamos verificar o anúncio antes de avançar.",
      intro: "O seu pedido está criado. Envie agora as capturas de ecrã do anúncio para iniciarmos as 12 verificações.",
      detail: deadlineText ? `Pode completar o envio até ${deadlineText}.` : "Pode completar o envio através do seu link privado.",
      actionUrl: uploadUrl,
      actionLabel: "Enviar capturas de ecrã (screenshot)"
    },
    relatorio: {
      subject: "O seu relatório da Verificação de Anúncio está pronto",
      eyebrow: "Análise concluída",
      title: "Veja o que confirmar antes de transferir dinheiro.",
      intro: "Organizámos as 12 verificações, a pesquisa pública de fotografias e os próximos passos num relatório privado.",
      detail: "Abra o relatório para consultar os pontos confirmados, o que continua por confirmar e as ações recomendadas.",
      actionUrl: reportUrl,
      actionLabel: "Ver relatório completo"
    },
    falha: {
      subject: "Não conseguimos concluir a análise do anúncio",
      eyebrow: "Análise interrompida",
      title: "Não lhe vamos entregar um relatório incompleto.",
      intro: "O processamento não reuniu condições técnicas para produzir uma análise fiável.",
      detail: "Encerrámos o pedido e iniciámos automaticamente o reembolso integral de 7,99 €.",
      actionUrl: null,
      actionLabel: null
    },
    lembrete_24h: {
      subject: "Falta enviar as capturas do anúncio",
      eyebrow: "O pedido está à sua espera",
      title: "Envie as capturas para começarmos a verificação.",
      intro: "O pagamento está confirmado, mas ainda não recebemos as capturas de ecrã necessárias para analisar o anúncio.",
      detail: deadlineText ? `O seu link privado fica disponível até ${deadlineText}.` : "Use o seu link privado para concluir o envio.",
      actionUrl: uploadUrl,
      actionLabel: "Enviar capturas de ecrã (screenshot)"
    },
    lembrete_7d: {
      subject: "Último dia para enviar as capturas do anúncio",
      eyebrow: "Último lembrete",
      title: "Ainda vai a tempo de concluir o pedido.",
      intro: "Falta enviar as capturas de ecrã do anúncio. Sem esses elementos, não conseguimos executar as 12 verificações.",
      detail: deadlineText ? `Conclua o envio até ${deadlineText}. Depois desse prazo, o pedido é encerrado e reembolsado automaticamente.` : "Conclua o envio antes de o link privado expirar.",
      actionUrl: uploadUrl,
      actionLabel: "Enviar capturas de ecrã (screenshot)"
    },
    reembolso: {
      subject: "O reembolso de 7,99 € foi iniciado",
      eyebrow: "Reembolso confirmado",
      title: "A devolução integral já foi emitida.",
      intro: "O pedido foi encerrado e enviámos a devolução de 7,99 € para o método de pagamento original.",
      detail: "O valor pode demorar alguns dias úteis a aparecer. O prazo final depende do banco ou emissor do cartão.",
      actionUrl: null,
      actionLabel: null
    }
  };
  return copies[type];
}

function renderHtml(copy, city) {
  const action = copy.actionUrl && copy.actionLabel
    ? `<tr><td style="padding:4px 32px 34px"><a href="${escapeHtml(copy.actionUrl)}" style="display:inline-block;padding:15px 22px;border-radius:9px;background:#d9ff72;color:#103d34;font-weight:800;text-decoration:none">${escapeHtml(copy.actionLabel)}</a></td></tr>`
    : "";
  const cityLine = city ? `<p style="margin:0 0 12px;color:#60736d;font-size:14px">Localidade indicada: <strong>${escapeHtml(city)}</strong></p>` : "";
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1e8;color:#123832;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1e8"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden"><tr><td style="padding:34px 32px;background:#06342f;color:#ffffff"><p style="margin:0 0 10px;color:#d9ff72;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase">${escapeHtml(copy.eyebrow)}</p><h1 style="margin:0;font-size:30px;line-height:1.1">${escapeHtml(copy.title)}</h1></td></tr><tr><td style="padding:30px 32px 18px"><p style="margin:0 0 16px;font-size:17px;line-height:1.6">${escapeHtml(copy.intro)}</p>${cityLine}<p style="margin:0;color:#60736d;font-size:15px;line-height:1.6">${escapeHtml(copy.detail)}</p></td></tr>${action}<tr><td style="padding:22px 32px;background:#eef3ef;color:#60736d;font-size:12px;line-height:1.55">Guia do Proprietário<br>Este é um email de serviço relativo ao seu pedido de Verificação de Anúncio.</td></tr></table></td></tr></table></body></html>`;
}

export function buildVerificationEmail(type, input = {}) {
  if (!TYPES.has(type)) throw new TypeError("Tipo de notificação inválido.");
  const uploadUrl = checkedHttpsUrl(input.uploadUrl, "O link de envio");
  const reportUrl = checkedHttpsUrl(input.reportUrl, "O link do relatório");
  const copy = copyFor(type, { uploadUrl, reportUrl, deadline: input.deadline });
  const city = String(input.city ?? "").trim().slice(0, 120);
  const text = [copy.title, copy.intro, city ? `Localidade indicada: ${city}.` : "", copy.detail,
    copy.actionUrl && copy.actionLabel ? `${copy.actionLabel}: ${copy.actionUrl}` : "",
    "Guia do Proprietário. Este é um email de serviço relativo ao seu pedido de Verificação de Anúncio."
  ].filter(Boolean).join("\n\n");
  return { subject: copy.subject, html: renderHtml(copy, city), text };
}
