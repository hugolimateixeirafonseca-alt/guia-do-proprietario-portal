interface Env {
  SENDER_API_TOKEN?: string;
  MAKE_PARTNER_NOTIFICATIONS_SECRET?: string;
}

interface RequestContext {
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

export const onRequestPost = async ({ request, env }: RequestContext) => {
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
  const subject = `${title || "Novo pedido de limpeza"} em ${municipality || "uma zona onde trabalha"}`;
  const html = `<!doctype html><html lang="pt"><body style="margin:0;background:#f2f6f4;font-family:Arial,sans-serif;color:#10221d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #d8e2de;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 24px;font-size:14px;color:#397562;font-weight:700">GUIA DO PROPRIETÁRIO</p><h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Tem um novo pedido compatível</h1><p style="margin:0 0 18px;font-size:17px;line-height:1.6">Olá, ${safeName}.</p><div style="padding:20px;background:#f2f6f4;border-radius:12px"><strong style="font-size:18px">${safeTitle}</strong><p style="margin:8px 0 0;line-height:1.6">${safeMunicipality}<br>${safeSummary}</p></div><p style="margin:22px 0;line-height:1.6">Os dados pessoais do cliente continuam protegidos. Ficam visíveis apenas se escolher este pedido.</p><p style="margin:0 0 24px"><a href="${safeUrl}" style="display:inline-block;padding:15px 22px;background:#397562;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Ver pedido no dashboard</a></p>${safeExpiry ? `<p style="margin:0;color:#63736d;font-size:13px">Pedido disponível até ${safeExpiry}.</p>` : ""}</td></tr></table></td></tr></table></body></html>`;
  const text = `Olá, ${partnerName}.\n\nTem um novo pedido compatível: ${title || "Novo pedido de limpeza"}, ${municipality || "zona do seu perfil"}.\n${summary}\n\nOs dados pessoais do cliente ficam visíveis apenas se escolher este pedido.\n\nVer pedido: ${dashboardUrl}${expiresAt ? `\n\nPedido disponível até ${expiresAt}.` : ""}`;

  const response = await fetch(SENDER_ENDPOINT, {
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
    console.error("partner_notification_sender_error", JSON.stringify({ eventId, status: response.status }));
    return json({ error: "sender_error", status: response.status }, 502);
  }

  return json({ ok: true, event_id: eventId });
};
