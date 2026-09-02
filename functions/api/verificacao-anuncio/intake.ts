import {
  PublicVerificationError,
  checkRateLimit,
  createPrivateAccess,
  encryptPrivateValue,
  ensureSameOrigin,
  json,
  readUpload,
  requireConfiguration,
  safeError,
  type RequestContext
} from "../../lib/verificacao-anuncio";
import { onRequestPost as subscribeMarketingEmail } from "../subscribe";
import { VERIFICACAO_DIRECT_CONSENT_VERSION } from "../../../src/data/consent";

export const handleVerificationIntake = async (
  { request, env }: RequestContext,
  options: { requireMarketingConsent?: boolean } = {}
) => {
  const storedKeys: string[] = [];
  let jobId = "";
  try {
    ensureSameOrigin(request);
    if (env.VERIFICACAO_PUBLIC_INTAKE_ENABLED !== "true") {
      throw new PublicVerificationError(503, "intake_not_available");
    }
    const config = requireConfiguration(env, true);
    await checkRateLimit(request, config.db, `${config.secret}:intake`, 4);
    const upload = await readUpload(request, {
      requireEmail: true,
      requireMarketingConsentVersion: options.requireMarketingConsent
        ? VERIFICACAO_DIRECT_CONSENT_VERSION
        : undefined
    });
    const access = await createPrivateAccess(config.secret);
    jobId = crypto.randomUUID();

    const files = [];
    for (const [index, capture] of upload.captures.entries()) {
      const key = `${jobId}/captura-${index + 1}-${crypto.randomUUID()}.${capture.extension}`;
      await config.uploads!.put(key, capture.bytes, {
        httpMetadata: { contentType: capture.contentType },
        customMetadata: { verificacaoId: jobId, ordem: String(index + 1), fase: "precheck" }
      });
      storedKeys.push(key);
      files.push({ key, contentType: capture.contentType, size: capture.size, ordem: index + 1 });
    }

    const createdAt = new Date();
    const precheckExpiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const reportExpiresAt = new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const metaAttributionCipher = upload.metaAttribution
      ? await encryptPrivateValue(JSON.stringify(upload.metaAttribution), config.secret)
      : null;
    const attribution = upload.marketingAttribution;
    await config.db.prepare(
      `INSERT INTO verificacao_anuncio_jobs
        (id, access_token_hash, access_token_cipher, stripe_session_id, email_cipher, meta_attribution_cipher, estado,
         cidade, ficheiros_json, criado_em, upload_em, upload_expira_em, expira_em,
         imagens_apagar_em, precheck_estado, pagamento_estado, source_channel,
         utm_source, utm_medium, utm_campaign, utm_content)
       VALUES (?, ?, ?, ?, ?, ?, 'em_analise', ?, ?, ?, ?, ?, ?, ?, 'processing', 'pendente', ?, ?, ?, ?, ?)`
    ).bind(
      jobId,
      access.tokenHash,
      access.tokenCipher,
      `pre_${jobId}`,
      await encryptPrivateValue(upload.email, config.secret),
      metaAttributionCipher,
      upload.cidade,
      JSON.stringify(files),
      createdAt.toISOString(),
      createdAt.toISOString(),
      precheckExpiresAt,
      reportExpiresAt,
      precheckExpiresAt,
      attribution.channel,
      attribution.source || null,
      attribution.medium || null,
      attribution.campaign || null,
      attribution.content || null
    ).run();

    if (options.requireMarketingConsent) {
      const subscriptionResponse = await subscribeMarketingEmail({
        request: new Request(new URL("/api/subscribe", request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || ""
          },
          body: JSON.stringify({
            email: upload.email,
            consent1: true,
            consent2: false,
            consentVersion: upload.consentVersion,
            source: "verificacao-anuncio-direct",
            pageUrl: new URL("/verificacao/enviar-direto/", request.url).toString(),
            eventId: jobId
          })
        }),
        env
      });
      if (!subscriptionResponse.ok) {
        throw new PublicVerificationError(502, "marketing_subscription_unavailable");
      }
    }

    await config.queue!.send({ type: "verificacao_anuncio_precheck", verificacaoId: jobId });
    await config.db.prepare(
      `INSERT INTO verificacao_anuncio_events (job_id, tipo, estado, criado_em)
       VALUES (?, 'precheck_recebido', 'success', ?)`
    ).bind(jobId, createdAt.toISOString()).run();

    return json({
      ok: true,
      etapa: "precheck_em_analise",
      progresso: 20,
      nextUrl: `/verificacao/enviar/?t=${encodeURIComponent(access.token)}`
    }, 202);
  } catch (error) {
    if (storedKeys.length && env.VERIFICACAO_ANUNCIO_UPLOADS) {
      try { await env.VERIFICACAO_ANUNCIO_UPLOADS.delete(storedKeys); } catch { /* limpeza agendada */ }
    }
    if (jobId && env.VERIFICACAO_ANUNCIO_DB) {
      try { await env.VERIFICACAO_ANUNCIO_DB.prepare("DELETE FROM verificacao_anuncio_jobs WHERE id = ? AND pagamento_estado = 'pendente'").bind(jobId).run(); }
      catch { /* a retenção continua a limitar os ficheiros */ }
    }
    return safeError(error);
  }
};

export const onRequestPost = (context: RequestContext) => handleVerificationIntake(context);
