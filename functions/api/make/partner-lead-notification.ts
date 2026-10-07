import {renderEmailCopyV2} from '../../lib/partner-email-copy-v2.mjs';
import {renderEmailLayout} from '../../lib/partner-email-layout.mjs';
import {renderPlannedPartnerEmail} from '../../lib/partner-planned-emails.mjs';
import {archivePartnerEmail} from '../../lib/partner-email-archive.mjs';
import {resolvePartnerEmailPolicy} from '../../lib/partner-email-policy.mjs';
import {reserveSenderRequest,recordSenderRateLimit} from '../../lib/sender-api-control.mjs';
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
const FROM = { email: "geral@guiadoproprietario.pt", name: "Hugo · Guia do Proprietário" };

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
  let applicationData;
  let commercialData: any;
  let dashboardUrl = clean(body.dashboard_url, 1200);
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

  const adminEvent=/^application-admin:[a-f0-9-]{36}$/.test(eventId);
  if(!adminEvent){
    try{
      const policy=await resolvePartnerEmailPolicy(env,partnerEmail,eventId,true);
      commercialData=policy.commercial_data;
      applicationData=policy.application_data;
      if(!policy.allowed)return json({ok:true,suppressed:true,event_id:eventId});
      if(policy.dashboard_url){
        const fresh=new URL(policy.dashboard_url);
        if(fresh.protocol!=='https:'||fresh.hostname!=='parceiros.guiadoproprietario.pt'||fresh.port||fresh.username||fresh.password)throw new Error('invalid_current_access');
        dashboardUrl=fresh.toString();
      }
    }catch{return json({error:'partner_email_policy_unavailable'},503);}
  }
  const welcome = /^welcome:[a-f0-9-]{36}$/.test(eventId);
  const application = /^application:[a-f0-9-]{36}$/.test(eventId);
  const adminApplication = /^application-admin:[a-f0-9-]{36}$/.test(eventId);
  if (adminApplication && partnerEmail !== 'hugo.lima.teixeira.fonseca@gmail.com') return json({error:'invalid_admin_recipient'},400);
  let message;
  if(welcome){
    // Current policy owns model and entitlements; never trust an old queued offer.
    if(!commercialData)return json({error:'commercial_policy_unavailable'},503);
    try { message=commercialData.copyVersion==='v2'?renderEmailCopyV2('P4',{...commercialData,name:partnerName,url:dashboardUrl}):renderPlannedPartnerEmail('P4',{...commercialData,name:partnerName,url:dashboardUrl}); }
    catch {return json({error:'commercial_policy_unavailable'},503);}
  } else if(application&&applicationData?.copyVersion==='v2'){
    try{message=renderEmailCopyV2('Candidatura',{...applicationData,name:partnerName});}catch{return json({error:'application_policy_unavailable'},503);}
  } else if(application||adminApplication){
    const subject=adminApplication?'Nova adesão de parceiro para aprovação':'Recebemos o seu pedido de adesão';
    const paragraphs=[adminApplication?summary+' A candidatura está pendente. Use a sua ligação privada de administração para consultar os dados e aprovar.':'Vamos analisar os dados enviados. Até à aprovação não recebe pedidos nem pode carregar saldo. Assim que a candidatura for aprovada, receberá um email com a ligação de acesso à sua área.'];
    message=renderEmailLayout({subject,preview:'Vamos analisar os dados enviados.',title:subject,name:partnerName,audience:adminApplication?'admin':'partner',paragraphs});
  } else {
    message=renderEmailLayout({subject:(title||'Novo pedido de limpeza')+' em '+(municipality||'uma zona onde trabalha'),preview:'Veja o pedido e escolha como obter o contacto.',title:'Tem um novo pedido compatível',name:partnerName,paragraphs:[title||'Novo pedido de limpeza',municipality||'Zona do seu perfil',summary||'Existe um novo pedido compatível com o seu perfil.','Os dados do cliente ficam disponíveis quando obtém o contacto. Consulte os preços e as opções partilhado e exclusivo no pedido.'],button:{label:'Ver pedido na minha área',url:dashboardUrl}});
  }
  const {subject,html,text}=message;

  // Group membership has its own durable queue. Never gate the application email on it.
  if (application && env.CLEANING_DASHBOARD_API_TOKEN) {
    const sync = processSenderSync(env,true).catch(() => { console.error('partner_group_queue_unavailable'); });
    if (waitUntil) waitUntil(sync); else await sync;
  }
  return deliverOnce(env.EMAIL_DELIVERY_DB,eventId,partnerEmail,async (markSending: () => Promise<void>) => {
  await reserveSenderRequest(env.EMAIL_DELIVERY_DB);
  if(!adminEvent)await archivePartnerEmail(env,eventId,partnerEmail,{subject,text});
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
    await recordSenderRateLimit(env.EMAIL_DELIVERY_DB,response,'email');
    // 429 is a confirmed rejection. A lost response or 5xx is ambiguous:
    // preserve for review rather than risking a duplicate email.
    return {state:response.status===429?'retry':response.status>=500?'uncertain':'failed',
      error:response.status===429?'sender_rate_limited':response.status>=500?'sender_response_unknown':'sender_rejected',
      providerStatus:response.status,retryAfter:providerRetryAfter(response.headers),status:503};
  }
  return {state:'sent'};
  },{acknowledgeReview:true});
};
