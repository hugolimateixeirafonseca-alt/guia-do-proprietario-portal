import {reserveSenderRequest} from '../../lib/sender-api-control.mjs';
import {processSenderSync} from '../../lib/cleaning-sender-sync.mjs';
import {deliverOnce,providerRetryAfter} from "../../lib/partner-email-delivery.mjs";
interface Env {
  EMAIL_DELIVERY_DB?: unknown;
  CLEANING_DASHBOARD_API_URL?: string;
  CLEANING_DASHBOARD_API_TOKEN?: string;
  SENDER_API_TOKEN?: string;
  MAKE_PARTNER_NOTIFICATIONS_SECRET?: string;
}

interface RequestContext {
  waitUntil?: (promise: Promise<unknown>) => void;
  request: Request;
  env: Env;
}

const SENDER_ENDPOINT = "https://api.sender.net/v2/message/send";
const FROM = { email: "geral@guiadoproprietario.pt", name: "Guia do Proprietário" };

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function secureEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] || character);
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export const onRequestPost = async ({ request, env, waitUntil }: RequestContext) => {
  const expected = env.MAKE_PARTNER_NOTIFICATIONS_SECRET || "";
  const supplied = request.headers.get("Authorization") || "";
  if (!expected || !secureEqual(supplied, `Bearer ${expected}`)) {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (!env.SENDER_API_TOKEN) return json({ error: "sender_not_configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId = clean(body.event_id, 100);
  const partnerName = clean(body.partner_name, 120);
  const partnerEmail = clean(body.partner_email, 254).toLowerCase();
  const dashboardUrl = clean(body.dashboard_url, 1200);
  const title = clean(body.lead_title, 120);
  const municipality = clean(body.municipality, 120);
  const summary = clean(body.lead_summary, 800);
  const expiresAt = clean(body.expires_at, 40);

  if (eventId.length < 8 || partnerName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)) {
    return json({ error: "invalid_recipient" }, 400);
  }
  try {
    const parsed = new URL(dashboardUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "parceiros.guiadoproprietario.pt") {
      return json({ error: "invalid_dashboard_url" }, 400);
    }
  } catch {
    return json({ error: "invalid_dashboard_url" }, 400);
  }

  const safeName = escapeHtml(partnerName);
  const safeTitle = escapeHtml(title || "Novo pedido de limpeza");
  const safeMunicipality = escapeHtml(municipality || "Zona do seu perfil");
  const safeSummary = escapeHtml(summary || "Existe um novo pedido compatível com o seu perfil.");
  const safeUrl = escapeHtml(dashboardUrl);
  const safeExpiry = escapeHtml(expiresAt);
  const welcome = /^welcome:[a-f0-9-]{36}$/.test(eventId);
  let subject = `${title || "Novo pedido de limpeza"} em ${municipality || "uma zona onde trabalha"}`;
  let html = `<!doctype html><html lang="pt"><body style="margin:0;background:#f2f6f4;font-family:Arial,sans-serif;color:#10221d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #d8e2de;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 24px;font-size:14px;color:#397562;font-weight:700">GUIA DO PROPRIETÁRIO</p><h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Tem um novo pedido compatível</h1><p style="margin:0 0 18px;font-size:17px;line-height:1.6">Olá, ${safeName}.</p><div style="padding:20px;background:#f2f6f4;border-radius:12px"><strong style="font-size:18px">${safeTitle}</strong><p style="margin:8px 0 0;line-height:1.6">${safeMunicipality}<br>${safeSummary}</p></div><p style="margin:22px 0;line-height:1.6">Os dados pessoais do cliente continuam protegidos até concluir a compra. Os pedidos são disponibilizados aos parceiros da zona. Contacto por 4,50 €: recebe os dados do cliente para apresentar a sua proposta. Até mais 2 empresas podem receber o mesmo contacto. Contacto exclusivo por 7 €: só a sua empresa recebe os dados deste cliente através do Guia do Proprietário. A opção exclusiva está disponível enquanto ninguém tiver comprado o contacto. Consulte as modalidades disponíveis no cartão.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;background:#397562;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Ver pedido no dashboard</a></p>${safeExpiry ? `<p style="margin:0;color:#63736d;font-size:13px">Pedido disponível até ${safeExpiry}.</p>` : ""}</td></tr></table></td></tr></table></body></html>`;
  let text = `Olá, ${partnerName}.\n\nTem um novo pedido compatível: ${title || "Novo pedido de limpeza"}, ${municipality || "zona do seu perfil"}.\n${summary}\n\nOs dados pessoais do cliente ficam visíveis após concluir a compra. Os pedidos são disponibilizados aos parceiros da zona. Contacto por 4,50 €: recebe os dados do cliente para apresentar a sua proposta. Até mais 2 empresas podem receber o mesmo contacto. Contacto exclusivo por 7 €: só a sua empresa recebe os dados deste cliente através do Guia do Proprietário. A opção exclusiva está disponível enquanto ninguém tiver comprado o contacto. Consulte as modalidades disponíveis no cartão.\n\nVer pedido: ${dashboardUrl}${expiresAt ? `\n\nPedido disponível até ${expiresAt}.` : ""}`;

  if (welcome) {
    subject = "A sua adesão ao Guia do Proprietário foi aprovada";
    html = `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#f2f6f4;font-family:Arial,sans-serif;color:#10221d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #d8e2de;border-radius:16px"><tr><td style="padding:32px"><p style="color:#397562;font-weight:700">GUIA DO PROPRIETÁRIO</p><h1 style="font-size:28px;line-height:1.2">A sua adesão foi aprovada</h1><p>Olá, ${safeName}.</p><p style="line-height:1.6">Bem-vindo à rede de parceiros do Guia do Proprietário. A sua adesão foi aprovada pela nossa equipa. Na sua área pode consultar novos pedidos, acompanhar os contactos aceites e atualizar as zonas e serviços onde trabalha.</p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;background:#397562;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Entrar na minha área de parceiro</a></p><p style="line-height:1.6">Nas novas adesões, os primeiros quatro contactos são gratuitos, com ou sem exclusividade, à sua escolha, sem limite diário. Os preços são 4,50 € por contacto ou 7 € por contacto exclusivo. O valor é descontado do saldo em euros apenas numa compra concluída. Cada contacto inicial aceite desconta um dos quatro gratuitos, qualquer que seja a modalidade escolhida. A opção exclusiva depende da disponibilidade do pedido.</p><p style="line-height:1.6">Os pedidos são disponibilizados aos parceiros da zona. Contacto por 4,50 €: recebe os dados do cliente para apresentar a sua proposta. Até mais 2 empresas podem receber o mesmo contacto. Contacto exclusivo por 7 €: só a sua empresa recebe os dados deste cliente através do Guia do Proprietário. A opção exclusiva está disponível enquanto ninguém tiver comprado o contacto. Consulte as modalidades disponíveis no cartão.</p><p style="line-height:1.6">Guarde este email para voltar a entrar. Esta ligação é pessoal: não a partilhe, pois dá acesso à sua área.</p><p style="font-size:13px;line-height:1.6">Se o botão não abrir, copie esta ligação para o navegador:<br><a href="${safeUrl}" style="color:#397562;word-break:break-all">${safeUrl}</a></p><p style="font-size:13px;line-height:1.6">Precisa de ajuda? Responda a este email.</p></td></tr></table></td></tr></table></body></html>`;
    text = `Olá, ${partnerName}.\n\nBem-vindo à rede de parceiros do Guia do Proprietário. A sua adesão foi aprovada.\n\nEntrar na minha área de parceiro: ${dashboardUrl}\n\nAqui pode consultar novos pedidos, acompanhar os contactos aceites e atualizar as zonas e serviços onde trabalha.\n\nNas novas adesões, os primeiros quatro contactos são gratuitos, com ou sem exclusividade, à sua escolha, sem limite diário. Os preços são 4,50 € por contacto ou 7 € por contacto exclusivo. O valor é descontado do saldo em euros apenas numa compra concluída. Cada contacto inicial aceite desconta um dos quatro gratuitos, qualquer que seja a modalidade escolhida. A opção exclusiva depende da disponibilidade do pedido.\n\nOs pedidos são disponibilizados aos parceiros da zona. Contacto por 4,50 €: recebe os dados do cliente para apresentar a sua proposta. Até mais 2 empresas podem receber o mesmo contacto. Contacto exclusivo por 7 €: só a sua empresa recebe os dados deste cliente através do Guia do Proprietário. A opção exclusiva está disponível enquanto ninguém tiver comprado o contacto. Consulte as modalidades disponíveis no cartão.\n\nGuarde este email para voltar a entrar. Esta ligação é pessoal: não a partilhe, pois dá acesso à sua área.\n\nPrecisa de ajuda? Responda a este email.`;
  }

  const application = /^application:[a-f0-9-]{36}$/.test(eventId);
  const adminApplication = /^application-admin:[a-f0-9-]{36}$/.test(eventId);
  if (adminApplication && partnerEmail !== 'hugo.lima.teixeira.fonseca@gmail.com') return json({error:'invalid_admin_recipient'},400);
  if (application || adminApplication) {
    subject = adminApplication ? 'Nova adesão de parceiro para aprovação' : 'Recebemos o seu pedido de adesão';
    const message = adminApplication
      ? summary + ' A candidatura está pendente. Use a sua ligação privada de administração para consultar os dados e aprovar.'
      : 'A sua adesão à rede de parceiros do Guia do Proprietário está sujeita a aprovação. Vamos analisar os dados enviados. Até à aprovação não recebe pedidos nem pode carregar saldo. Assim que a candidatura for aprovada, receberá um email com a ligação de acesso à sua área de parceiro.';
    html = '<!doctype html><html lang="pt-PT"><body style="font-family:Arial,sans-serif;background:#f2f6f4;color:#203d36;padding:24px"><main style="max-width:600px;margin:auto;background:white;padding:28px;border-radius:16px"><p>GUIA DO PROPRIETÁRIO</p><h1>'+escapeHtml(subject)+'</h1><p>Olá, '+safeName+'.</p><p style="line-height:1.7">'+escapeHtml(message)+'</p><p>Se precisar de ajuda, responda a este email.</p></main></body></html>';
    text = 'Olá, '+partnerName+'.\n\n'+message+'\n\nSe precisar de ajuda, responda a este email.';
  }

  // Group membership has its own durable queue. Never gate the application email on it.
  if (application && env.CLEANING_DASHBOARD_API_TOKEN) {
    const sync = processSenderSync(env,true).catch(() => { console.error('partner_group_queue_unavailable'); });
    if (waitUntil) waitUntil(sync); else await sync;
  }
  return deliverOnce(env.EMAIL_DELIVERY_DB,eventId,partnerEmail,async (markSending: () => Promise<void>) => {
  await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
  await markSending();
  const response = await fetch(SENDER_ENDPOINT, {
    signal:AbortSignal.timeout(12000),
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SENDER_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: FROM,
      to: { email: partnerEmail, name: partnerName },
      subject,
      text,
      html,
      headers: { "X-GP-Event-ID": eventId, charset: "utf-8" }
    })
  });

  if (!response.ok) {
    // 429 is a confirmed rejection. A lost response or 5xx is ambiguous:
    // preserve for review rather than risking a duplicate email.
    return {state:response.status===429?'retry':response.status>=500?'uncertain':'failed',
      error:response.status===429?'sender_rate_limited':response.status>=500?'sender_response_unknown':'sender_rejected',
      providerStatus:response.status,retryAfter:providerRetryAfter(response.headers),status:503};
  }
  return {state:'sent'};
  });
};
