import { validateAccessToken } from "../../../src/lib/verificacao-anuncio/intake.mjs";
import { PublicVerificationError, requireConfiguration, safeError, sha256, type RequestContext } from "../../lib/verificacao-anuncio";

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env, true);
    const rawToken = decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "");
    let token: string;
    try { token = validateAccessToken(rawToken); } catch { throw new PublicVerificationError(404, "report_not_found"); }
    const row = await config.db.prepare(
      `SELECT relatorio_pdf_key AS pdfKey, expira_em AS expiraEm
       FROM verificacao_anuncio_jobs WHERE access_token_hash = ? AND estado = 'entregue' LIMIT 1`
    ).bind(await sha256(token)).first<{ pdfKey: string; expiraEm: string }>();
    if (!row?.pdfKey || Date.parse(row.expiraEm) <= Date.now()) throw new PublicVerificationError(404, "report_not_found");
    const object = await config.uploads!.get(row.pdfKey);
    if (!object) throw new PublicVerificationError(404, "report_not_found");
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=verificacao-anuncio.pdf",
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return safeError(error);
  }
};
