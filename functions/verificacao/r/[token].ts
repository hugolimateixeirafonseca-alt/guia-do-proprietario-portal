import { validateAccessToken } from "../../../src/lib/verificacao-anuncio/intake.mjs";
import { renderReportHtml } from "../../../src/lib/verificacao-anuncio/report-renderer.mjs";
import { PublicVerificationError, requireConfiguration, safeError, sha256, type RequestContext } from "../../lib/verificacao-anuncio";

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    const rawToken = decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "");
    let token: string;
    try { token = validateAccessToken(rawToken); } catch { throw new PublicVerificationError(404, "report_not_found"); }
    const row = await config.db.prepare(
      `SELECT id, resultado_json AS resultadoJson, criado_em AS criadoEm, entregue_em AS entregueEm,
        expira_em AS expiraEm, ficheiros_json AS ficheirosJson, imagens_apagadas AS imagensApagadas
       FROM verificacao_anuncio_jobs WHERE access_token_hash = ? AND estado = 'entregue' AND pagamento_estado = 'pago' LIMIT 1`
    ).bind(await sha256(token)).first<{ id: string; resultadoJson: string; criadoEm: string; entregueEm: string; expiraEm: string; ficheirosJson: string | null; imagensApagadas: number }>();
    if (!row || Date.parse(row.expiraEm) <= Date.now()) throw new PublicVerificationError(404, "report_not_found");
    let capturePreviews: Array<{ url: string; label: string }> = [];
    if (!row.imagensApagadas && row.ficheirosJson) {
      try {
        const files = JSON.parse(row.ficheirosJson);
        if (Array.isArray(files)) {
          capturePreviews = files.slice(0, 8).map((_file, index) => ({
            url: `/verificacao/evidence/${encodeURIComponent(token)}/${index + 1}`,
            label: `Captura ${index + 1}`
          }));
        }
      } catch { /* um manifesto antigo não impede a abertura do relatório */ }
    }
    const html = renderReportHtml({
      report: JSON.parse(row.resultadoJson),
      createdAt: row.entregueEm || row.criadoEm,
      expiresAt: row.expiraEm,
      capturePreviews
    });
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      }
    });
  } catch (error) {
    return safeError(error);
  }
};
